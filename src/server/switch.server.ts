import { ValveController } from "shared/ValveController";

const ReplicatedStorage = game.GetService("ReplicatedStorage");
const switchEvent = ReplicatedStorage.WaitForChild("SwitchDrag") as RemoteEvent;

const valvesFolder = (game.Workspace.FindFirstChild("ValveControllers") as Folder)!;

const valveStates = new Map<Part, ValveController>();

for (const child of valvesFolder.GetChildren()) {
	if (child.IsA("Part")) {
		const inst = new ValveController();

		const highlight = new Instance("Highlight");
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

switchEvent.OnServerEvent.Connect((player, ...args) => {
	const [action, valve, value] = args as [string, Part, number?];

	const state = valveStates.get(valve)!;
	print("action", action, "value", value);

	if (action === "startDrag" && typeIs(value, "number")) {
		print("start drag");
		if (!state.owner) {
			state.owner = player;
		}

		state.setPosition(value);
		state.highlight!.Enabled = true;
		updatePart(valve);
	} else if (action === "update" && typeIs(value, "number")) {
		if (state.owner !== player) return;

		state.setPosition(value);
		updatePart(valve);
	} else if (action === "reset") {
		if (state.owner !== player) return;

		state.highlight!.Enabled = false;
		if (value === 0) {
			state.reset();
			updatePart(valve);
		}

		state.owner = undefined;
	}
});
