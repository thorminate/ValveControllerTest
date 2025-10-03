import { flashHighlight } from "shared/flashHighlight";

const UserInputService = game.GetService("UserInputService");
const RunService = game.GetService("RunService");

const ReplicatedStorage = game.GetService("ReplicatedStorage");
const switchFunc = ReplicatedStorage.WaitForChild("SwitchFunction") as RemoteFunction<
	(action: string, valve: Part, value?: number) => number
>;
const switchEvent = ReplicatedStorage.WaitForChild("SwitchEvent") as RemoteEvent<
	(action: string, valve: Part, value?: number) => void
>;

const player = game.GetService("Players").LocalPlayer;
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

interface ControllerState {
	dragging: boolean;
	startX: number;
	basePosition: number;
	isLocked: boolean;
	position: number;
}

const controllerStates = new Map<Part, ControllerState>();

const valveControllersFolder = game.Workspace.WaitForChild("ValveControllers") as Folder;
valveControllersFolder.GetChildren().forEach((valveController) => {
	if (valveController.IsA("Part")) {
		controllerStates.set(valveController, {
			dragging: false,
			startX: 0,
			basePosition: 0,
			isLocked: false,
			position: 0,
		});
	}
});

let lockEnabled = false;
let activeController: Part | undefined;

UserInputService.InputBegan.Connect((input, gameProcessed) => {
	if (input.UserInputType === Enum.UserInputType.MouseButton1) {
		const mouse = UserInputService.GetMouseLocation();
		let ray = game.Workspace.CurrentCamera!.ViewportPointToRay(mouse.X, mouse.Y);

		ray = new Ray(ray.Origin.sub(ray.Direction.mul(2)), ray.Direction);

		const params = new RaycastParams();
		params.FilterType = Enum.RaycastFilterType.Include;
		params.FilterDescendantsInstances = [game.Workspace.WaitForChild("ValveControllers") as Folder];

		const result = game.Workspace.Raycast(ray.Origin, ray.Direction.mul(500), params);

		if (result && controllerStates.has(result.Instance as Part)) {
			const part = result.Instance as Part;
			const state = controllerStates.get(part)!;

			activeController = part;
			modalUnlock.Visible = true;
			state.startX = mouse.X;
			state.dragging = true;

			const toHit = result.Position.sub(part.Position);

			const cameraToPart = part.Position.sub(game.Workspace.CurrentCamera!.CFrame.Position);
			const signFactor = cameraToPart.Dot(part.CFrame.LookVector) > 0 ? 1 : -1;

			const projectedX = toHit.Dot(part.CFrame.RightVector) * signFactor;

			if (projectedX > 0.2) state.basePosition = 1;
			else if (projectedX < 0.2) state.basePosition = -1;
			else state.basePosition = 0;

			state.position = state.basePosition;

			const response = switchFunc.InvokeServer("startDrag", part, state.basePosition);

			if (response !== 0) {
				activeController = undefined;
				state.dragging = false;
				modalUnlock.Visible = false;
				// make the button blink red
				flashHighlight(
					part,
					Color3.fromRGB(255, 94, 94),
					Color3.fromRGB(255, 143, 143),
					0.3,
					0.5,
					0.2,
					state.dragging,
					state.isLocked,
				);
			}
		}
	} else if (input.KeyCode === Enum.KeyCode.Q && !gameProcessed) {
		lockEnabled = !lockEnabled;

		for (const valve of valveControllersFolder.GetChildren()) {
			if (valve.IsA("Part")) {
				const state = controllerStates.get(valve)!;
				flashHighlight(
					valve,
					Color3.fromRGB(200, 160, 255),
					Color3.fromRGB(227, 207, 255),
					0.2,
					0.5,
					0.2,
					state.dragging,
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

		if (result && controllerStates.has(result.Instance as Part)) {
			const part = result.Instance as Part;
			const state = controllerStates.get(part)!;

			if (state.dragging) return;

			state.isLocked = false;
			switchEvent.FireServer("reset", part, 0);
		}
	}
});

RunService.RenderStepped.Connect(() => {
	if (!activeController) return;

	const state = controllerStates.get(activeController)!;

	const mouseX = UserInputService.GetMouseLocation().X;
	const delta = mouseX - state.startX;

	const step = math.clamp(state.basePosition + math.floor(delta / 50), -2, 2);
	state.position = step;
	switchEvent.FireServer("update", activeController, step);
});

UserInputService.InputEnded.Connect(async (input) => {
	if (input.UserInputType === Enum.UserInputType.MouseButton1 && activeController) {
		const state = controllerStates.get(activeController)!;
		state.dragging = false;
		state.isLocked = lockEnabled && state.position !== 0;
		const part = activeController;
		activeController = undefined;
		switchEvent.FireServer("reset", part, lockEnabled ? 1 : 0);

		modalUnlock.Visible = false;
	}
});
