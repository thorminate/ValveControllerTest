import { flashHighlight } from "shared/flashHighlight";
import { ValveController } from "shared/ValveController";

const UserInputService = game.GetService("UserInputService");
const RunService = game.GetService("RunService");

const ReplicatedStorage = game.GetService("ReplicatedStorage");
const switchFunc = ReplicatedStorage.WaitForChild("SwitchFunction") as RemoteFunction<
	(action: string, valve: Part, value?: number) => number | ValveController
>;
const switchEvent = ReplicatedStorage.WaitForChild("SwitchEvent") as RemoteEvent<
	(action: string, valve: Part, value?: number) => void
>;

const valveControllersFolder = game.Workspace.WaitForChild("ValveControllers") as Folder;

const player = game.GetService("Players").LocalPlayer;

function getState(valve: Part) {
	return switchFunc.InvokeServer("getState", valve) as ValveController;
}

// ─────────────────────────────────────────────────────────────
// DESKTOP: hold-and-drag
// ─────────────────────────────────────────────────────────────
if (UserInputService.KeyboardEnabled && UserInputService.MouseEnabled) {
	const playerGui = player.WaitForChild("PlayerGui") as PlayerGui;
	const screenGui = new Instance("ScreenGui");
	screenGui.Parent = playerGui;
	const modalUnlock = new Instance("TextButton");
	modalUnlock.Parent = screenGui;
	modalUnlock.Size = new UDim2(0, 0, 0, 0);
	modalUnlock.Position = new UDim2(0, 0, 0, 0);
	modalUnlock.Text = "";
	modalUnlock.BackgroundTransparency = 1;
	modalUnlock.Modal = true;
	modalUnlock.Visible = false;

	let lockEnabled = false;
	let activeController: Part | undefined;
	let startX = 0;
	let basePosition = 0;

	UserInputService.InputBegan.Connect((input, gameProcessed) => {
		if (gameProcessed) return;
		if (input.UserInputType === Enum.UserInputType.MouseButton1) {
			const mouse = UserInputService.GetMouseLocation();
			let ray = game.Workspace.CurrentCamera!.ViewportPointToRay(mouse.X, mouse.Y);

			ray = new Ray(ray.Origin.sub(ray.Direction.mul(2)), ray.Direction);

			const params = new RaycastParams();
			params.FilterType = Enum.RaycastFilterType.Include;
			params.FilterDescendantsInstances = [game.Workspace.WaitForChild("ValveControllers") as Folder];

			const result = game.Workspace.Raycast(ray.Origin, ray.Direction.mul(500), params);

			if (result) {
				const part = result.Instance as Part;
				const state = getState(part);

				if (!state) return;

				activeController = part;
				modalUnlock.Visible = true;
				startX = mouse.X;

				const toHit = result.Position.sub(part.Position);

				const cameraToPart = part.Position.sub(game.Workspace.CurrentCamera!.CFrame.Position);
				const signFactor = cameraToPart.Dot(part.CFrame.LookVector) > 0 ? 1 : -1;

				const projectedX = toHit.Dot(part.CFrame.RightVector) * signFactor;

				if (projectedX >= 0) basePosition = 1;
				else if (projectedX < 0) basePosition = -1;

				const response = switchFunc.InvokeServer("startDrag", part, basePosition);

				if (response !== 0) {
					activeController = undefined;
					modalUnlock.Visible = false;
					// make the button blink red
					flashHighlight(
						part,
						Color3.fromRGB(255, 94, 94),
						Color3.fromRGB(255, 143, 143),
						0.3,
						0.5,
						0.2,
						getState(part).owner !== undefined,
						state.isLocked,
					);
				}
			}
		} else if (input.KeyCode === Enum.KeyCode.Q) {
			lockEnabled = !lockEnabled;

			for (const valve of valveControllersFolder.GetChildren()) {
				if (valve.IsA("Part")) {
					const state = getState(valve);
					flashHighlight(
						valve,
						Color3.fromRGB(227, 209, 255),
						Color3.fromRGB(255, 255, 255),
						0.2,
						0.5,
						0.2,
						!!state.owner,
						state.isLocked,
					);
				}
			}
		} else if (input.UserInputType === Enum.UserInputType.MouseButton2) {
			const mouse = UserInputService.GetMouseLocation();
			let ray = game.Workspace.CurrentCamera!.ViewportPointToRay(mouse.X, mouse.Y);

			ray = new Ray(ray.Origin.sub(ray.Direction.mul(2)), ray.Direction);

			const params = new RaycastParams();
			params.FilterType = Enum.RaycastFilterType.Include;
			params.FilterDescendantsInstances = [game.Workspace.WaitForChild("ValveControllers") as Folder];

			const result = game.Workspace.Raycast(ray.Origin, ray.Direction.mul(500), params);

			if (result) {
				switchEvent.FireServer("reset", result.Instance as Part, 0);
			}
		}
	});

	RunService.RenderStepped.Connect(() => {
		if (!activeController) return;

		const mouseX = UserInputService.GetMouseLocation().X;
		const delta = mouseX - startX;

		const step = math.clamp(basePosition + math.floor(delta / 75), -2, 2);
		switchEvent.FireServer("update", activeController, step);
	});

	UserInputService.InputEnded.Connect(async (input, gameProcessed) => {
		if (input.UserInputType === Enum.UserInputType.MouseButton1 && activeController) {
			if (gameProcessed) return;

			const part = activeController;
			activeController = undefined;
			switchEvent.FireServer("reset", part, lockEnabled ? 1 : 0);

			modalUnlock.Visible = false;
			startX = 0;
			basePosition = 0;
		}
	});
}

// ─────────────────────────────────────────────────────────────
// MOBILE: tap to step left/right
// ─────────────────────────────────────────────────────────────

if (UserInputService.TouchEnabled) {
	UserInputService.TouchTap.Connect((touchPos, gameProcessed) => {
		if (gameProcessed) return;

		const touch = touchPos[0];

		const cam = game.Workspace.CurrentCamera!;
		const ray = cam.ViewportPointToRay(touch.X, touch.Y);
		const params = new RaycastParams();
		params.FilterType = Enum.RaycastFilterType.Include;
		params.FilterDescendantsInstances = [game.Workspace.WaitForChild("ValveControllers") as Folder];

		const result = game.Workspace.Raycast(ray.Origin, ray.Direction.mul(500), params);

		const hitPart = result?.Instance;
		if (!hitPart) return;

		const valve = hitPart.IsA("Part") ? hitPart : hitPart.Parent?.FindFirstChildWhichIsA("Part");
		if (!valve) return;

		const valveCFrame = valve.CFrame;
		const localHit = valveCFrame.PointToObjectSpace(result.Position);

		let direction = 0;

		if (localHit.X >= 0) direction = 1;
		else if (localHit.X < 0) direction = -1;

		if (direction === 0) return;

		let response = undefined;

		if (direction === 1) response = switchFunc.InvokeServer("increment", valve);
		else response = switchFunc.InvokeServer("decrement", valve);

		if (response !== 0) {
			flashHighlight(
				valve,
				Color3.fromRGB(255, 0, 0),
				Color3.fromRGB(255, 255, 255),
				0.2,
				0.5,
				0.2,
				false,
				false,
			);
		}
	});
}
