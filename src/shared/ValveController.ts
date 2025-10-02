export class ValveController {
	owner?: Player;
	highlight?: Highlight;
	private position = 0;
	private readonly min = -2;
	private readonly max = 2;

	public setPosition(pos: number) {
		this.position = math.clamp(pos, this.min, this.max);
		return this.position;
	}

	public getPosition() {
		return this.position;
	}

	public reset() {
		this.position = 0;
		return this.position;
	}
}
