const TweenService = game.GetService("TweenService");

export function flashHighlight(
	valveController: Part,
	color: Color3,
	outlineColor: Color3,
	fadeInTime: number,
	fadeOutTime: number,
	holdTime: number,
	dragging: boolean,
	isLocked: boolean,
) {
	let firstColor = color;
	let firstOutlineColor = outlineColor;
	let isPrecolored = false;

	if (isLocked) {
		isPrecolored = true;
		color = Color3.fromRGB(200, 160, 255);
		outlineColor = Color3.fromRGB(227, 207, 255);
	} else if (dragging) {
		isPrecolored = true;
		color = Color3.fromRGB(255, 255, 255);
		outlineColor = Color3.fromRGB(255, 255, 255);
	}

	const highlight = new Instance("Highlight");
	highlight.Name = "ValveHighlight";
	highlight.Adornee = valveController;
	highlight.Parent = valveController;
	highlight.FillColor = color;
	highlight.OutlineColor = outlineColor;
	highlight.FillTransparency = isPrecolored ? 0.7 : 1;
	highlight.OutlineTransparency = isPrecolored ? 0.5 : 1;
	highlight.Enabled = true;

	const tweenInfo = new TweenInfo(fadeInTime, Enum.EasingStyle.Quad, Enum.EasingDirection.Out);
	const tween = TweenService.Create(highlight, tweenInfo, {
		FillTransparency: 0.7,
		OutlineTransparency: 0.5,
		FillColor: firstColor,
		OutlineColor: firstOutlineColor,
	});
	tween.Play();

	task.delay(holdTime, () => {
		const tweenInfo = new TweenInfo(fadeOutTime, Enum.EasingStyle.Quad, Enum.EasingDirection.Out);
		const tween = TweenService.Create(highlight, tweenInfo, {
			FillTransparency: isPrecolored ? 0.7 : 1,
			OutlineTransparency: isPrecolored ? 0.5 : 1,
			FillColor: color,
			OutlineColor: outlineColor,
		});
		tween.Play();
		tween.Completed.Connect(() => {
			highlight.Destroy();
		});
	});
}
