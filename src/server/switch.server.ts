import { ValveController } from "shared/ValveController";

const ReplicatedStorage = game.GetService("ReplicatedStorage");
const switchFunc = ReplicatedStorage.WaitForChild("SwitchFunction") as RemoteFunction;
const switchEvent = ReplicatedStorage.WaitForChild("SwitchEvent") as RemoteEvent;

const valvesFolder = (game.Workspace.FindFirstChild("ValveControllers") as Folder)!;

const valveStates = new Map<Part, ValveController>();

for (const child of valvesFolder.GetChildren()) {
	if (child.IsA("Part")) {
		const inst = new ValveController();

		const highlight = new Instance("Highlight");
		highlight.Name = "ValveHighlight";
		highlight.Adornee = child;
		highlight.Parent = child;
		highlight.FillColor = new Color3(1, 1, 1);
		highlight.OutlineColor = new Color3(1, 1, 1);
		highlight.FillTransparency = 0.7;
		highlight.OutlineTransparency = 0.5;
		highlight.Enabled = false;

		inst.highlight = highlight;

		valveStates.set(child, inst);
	}
}

function updatePart(part: Part) {
	const state = valveStates.get(part)!;
	const pos = state.getPosition();
	const angle = math.rad(-pos * 15);
	part.CFrame = new CFrame(part.Position).mul(CFrame.Angles(0, angle, 0));
}

function updateHighlight(valveController: Part, state: ValveController) {
	const highlight = state.highlight!;

	if (state.owner) {
		highlight.FillColor = Color3.fromRGB(255, 255, 255);
		highlight.OutlineColor = Color3.fromRGB(255, 255, 255);
		highlight.FillTransparency = 0.7;
		highlight.OutlineTransparency = 0.5;
		highlight.Enabled = true;
	} else if (state.isLocked && state.getPosition() !== 0) {
		highlight.FillColor = Color3.fromRGB(200, 160, 255);
		highlight.OutlineColor = Color3.fromRGB(227, 207, 255);
		highlight.FillTransparency = 0.7;
		highlight.OutlineTransparency = 0.5;
		highlight.Enabled = true;
	} else {
		highlight.Enabled = false;
	}
}

function reset(player: Player, state: ValveController, valve: Part, value?: number) {
	state.isLocked = value === 1;
	state.owner = undefined;
	updateHighlight(valve, state);
	if (value === 0) {
		state.reset();
		updatePart(valve);
	}

	state.owner = undefined;
}

switchFunc.OnServerInvoke = (player, ...args) => {
	const [action, valve, value] = args as [string, Part, number?];
	const state = valveStates.get(valve)!;
	const distance = valve.Position.sub(player.Character?.PrimaryPart?.Position as Vector3).Magnitude;
	if (distance > 35) return 2; // 2 = too far away

	if (action === "startDrag" && typeIs(value, "number")) {
		if (!state.owner) {
			state.owner = player;
		} else if (state.owner !== player) {
			return 1; // 1 = not owner
		}

		state.setPosition(value);
		state.isLocked = false;
		updateHighlight(valve, state);
		updatePart(valve);
		return 0; // 0 = success
	}
};

switchEvent.OnServerEvent.Connect((player, ...args) => {
	const [action, valve, value] = args as [string, Part, number?];

	const state = valveStates.get(valve)!;

	const distance = valve.Position.sub(player.Character?.PrimaryPart?.Position as Vector3).Magnitude;

	if (action === "update" && typeIs(value, "number")) {
		if (distance > 35) {
			reset(player, state, valve, 0);
			return 2; // 2 = too far away
		}
		if (!state.owner || state.owner !== player) return 1; // 1 = not owner

		state.setPosition(value);
		updatePart(valve);
		return 0; // 0 = success
	} else if (action === "reset" && typeIs(value, "number")) {
		if (state.owner && state.owner !== player) return 1; // 1 = not owner

		reset(player, state, valve, value);
		return 0; // 0 = success
	}
});
