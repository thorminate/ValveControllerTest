const UserInputService = game.GetService("UserInputService");
const RunService = game.GetService("RunService");

const ReplicatedStorage = game.GetService("ReplicatedStorage");
const switchEvent = ReplicatedStorage.WaitForChild("SwitchDrag") as RemoteEvent;

const player = game.GetService("Players").LocalPlayer;
const playerGui = player.WaitForChild("PlayerGui") as PlayerGui;

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
}

const controllerStates = new Map<Part, ControllerState>();

const valveControllersFolder = game.Workspace.WaitForChild("ValveControllers") as Folder;
valveControllersFolder.GetChildren().forEach((valveController) => {
	if (valveController.IsA("Part")) {
		controllerStates.set(valveController, {
			dragging: false,
			startX: 0,
			basePosition: 0,
		});
	}
});

let lockEnabled = false;
let activeController: Part | undefined;

UserInputService.InputBegan.Connect((input, gameProcessed) => {
	if (input.UserInputType === Enum.UserInputType.MouseButton1) {
		const mouse = UserInputService.GetMouseLocation();
		const ray = game.Workspace.CurrentCamera!.ViewportPointToRay(mouse.X, mouse.Y);
		const result = game.Workspace.Raycast(ray.Origin, ray.Direction.mul(500));

		if (result && controllerStates.has(result.Instance as Part)) {
			const part = result.Instance as Part;
			const state = controllerStates.get(part)!;

			const toHit = result.Position.sub(part.Position);

			const cameraToPart = part.Position.sub(game.Workspace.CurrentCamera!.CFrame.Position);
			const signFactor = cameraToPart.Dot(part.CFrame.LookVector) > 0 ? 1 : -1;

			const projectedX = toHit.Dot(part.CFrame.RightVector) * signFactor;

			if (projectedX > 0.1) state.basePosition = 1;
			else if (projectedX < -0.1) state.basePosition = -1;
			else state.basePosition = 0;

			switchEvent.FireServer("startDrag", part, state.basePosition);

			state.dragging = true;
			state.startX = mouse.X;
			activeController = part;

			modalUnlock.Visible = true;
		}
	} else if (input.KeyCode === Enum.KeyCode.Q && !gameProcessed) {
		lockEnabled = !lockEnabled;
	}
});

RunService.RenderStepped.Connect(() => {
	if (!activeController) return;

	const state = controllerStates.get(activeController)!;

	const mouseX = UserInputService.GetMouseLocation().X;
	const delta = mouseX - state.startX;

	const step = math.clamp(state.basePosition + math.floor(delta / 50), -2, 2);
	switchEvent.FireServer("update", activeController, step);
});

UserInputService.InputEnded.Connect((input) => {
	if (input.UserInputType === Enum.UserInputType.MouseButton1 && activeController) {
		const state = controllerStates.get(activeController)!;
		state.dragging = false;
		switchEvent.FireServer("reset", activeController, lockEnabled ? 1 : 0);

		modalUnlock.Visible = false;

		activeController = undefined;
	}
});
