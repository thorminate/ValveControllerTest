const UserInputService = game.GetService("UserInputService");
const RunService = game.GetService("RunService");

const TweenService = game.GetService("TweenService");

const ReplicatedStorage = game.GetService("ReplicatedStorage");
const switchEvent = ReplicatedStorage.WaitForChild("SwitchDrag") as RemoteEvent;

const player = game.GetService("Players").LocalPlayer;
const playerGui = player.WaitForChild("PlayerGui") as PlayerGui;
const character = player.Character!;

const screenGui = new Instance("ScreenGui", playerGui);

const modalUnlock = new Instance("TextButton", screenGui);
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

function tweenHighlight(highlight: Highlight, fadeIn: boolean) {
	const goal = fadeIn
		? {
				FillTransparency: 0.7,
				OutlineTransparency: 0.5,
			}
		: {
				FillTransparency: 1,
				OutlineTransparency: 1,
			};

	const tweenInfo = new TweenInfo(
		fadeIn ? 0.1 : 0.2,
		fadeIn ? Enum.EasingStyle.Circular : Enum.EasingStyle.Quad,
		Enum.EasingDirection.Out,
	);
	const tween = TweenService.Create(highlight, tweenInfo, goal);
	tween.Play();
}

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

			const toHit = result.Position.sub(part.Position);

			const cameraToPart = part.Position.sub(game.Workspace.CurrentCamera!.CFrame.Position);
			const signFactor = cameraToPart.Dot(part.CFrame.LookVector) > 0 ? 1 : -1;

			const projectedX = toHit.Dot(part.CFrame.RightVector) * signFactor;

			if (projectedX > 0.2) state.basePosition = 1;
			else if (projectedX < -0.2) state.basePosition = -1;
			else state.basePosition = 0;

			switchEvent.FireServer("startDrag", part, state.basePosition);

			state.dragging = true;
			state.startX = mouse.X;
			state.position = state.basePosition;
			activeController = part;

			modalUnlock.Visible = true;
		}
	} else if (input.KeyCode === Enum.KeyCode.Q && !gameProcessed) {
		lockEnabled = !lockEnabled;

		for (const valve of valveControllersFolder.GetChildren()) {
			if (valve.IsA("Part")) {
				const highlight = valve.WaitForChild("ValveHighlight") as Highlight;
				const state = controllerStates.get(valve)!;
				if (highlight) {
					if (state.isLocked === true || state.dragging === true) continue;
					highlight.FillColor = Color3.fromRGB(200, 160, 255);
					highlight.OutlineColor = Color3.fromRGB(227, 207, 255);
					highlight.FillTransparency = 1;
					highlight.OutlineTransparency = 1;
					highlight.Enabled = true;

					tweenHighlight(highlight, true);
				}
			}
		}

		task.delay(0.3, () => {
			for (const valve of valveControllersFolder.GetChildren()) {
				if (valve.IsA("Part")) {
					const highlight = valve.WaitForChild("ValveHighlight") as Highlight;
					const state = controllerStates.get(valve)!;
					print("state", state);
					if (highlight) {
						if (state.isLocked === true || state.dragging === true) continue;
						tweenHighlight(highlight, false);
						task.delay(0.2, () => {
							highlight.Enabled = false;
							highlight.FillColor = Color3.fromRGB(255, 255, 255);
							highlight.OutlineColor = Color3.fromRGB(255, 255, 255);
							highlight.FillTransparency = 0.7;
							highlight.OutlineTransparency = 0.5;
						});
					}
				}
			}
		});
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

UserInputService.InputEnded.Connect((input) => {
	if (input.UserInputType === Enum.UserInputType.MouseButton1 && activeController) {
		const state = controllerStates.get(activeController)!;
		state.dragging = false;
		state.isLocked = lockEnabled && state.position !== 0;
		switchEvent.FireServer("reset", activeController, lockEnabled ? 1 : 0);

		modalUnlock.Visible = false;

		activeController = undefined;
	}
});
