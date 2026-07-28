import { math } from "../../../shared/utils/math";

const MAX_DISPLAY_SPEED = 300;
const MAX_GAME_SPEED = 26;

export class VehicleHud {
    private readonly root = document.getElementById("ui-vehicle-hud")!;
    private readonly speedNeedle = document.getElementById("vehicle-speed-needle")!;
    private readonly rpmNeedle = document.getElementById("vehicle-rpm-needle")!;
    private readonly speedValue = document.getElementById("vehicle-speed-value")!;
    private readonly rpmValue = document.getElementById("vehicle-rpm-value")!;
    private readonly gearValue = document.getElementById("vehicle-gear-value")!;

    private visible = false;
    private displayedSpeed = 0;

    update(dt: number, vehicleId: number, gameSpeed: number) {
        const shouldShow = vehicleId !== 0;
        if (shouldShow !== this.visible) {
            this.visible = shouldShow;
            this.root.classList.toggle("is-visible", shouldShow);
            this.root.setAttribute("aria-hidden", String(!shouldShow));
        }
        if (!shouldShow) {
            this.displayedSpeed = 0;
            return;
        }

        const speedKph = Math.abs(gameSpeed) * (MAX_DISPLAY_SPEED / MAX_GAME_SPEED);
        const smoothing = math.clamp(dt * 9, 0, 1);
        this.displayedSpeed += (speedKph - this.displayedSpeed) * smoothing;

        const speedT = math.clamp(this.displayedSpeed / MAX_DISPLAY_SPEED, 0, 1);
        const rpm = 900 + speedT * 6_400;
        const rpmT = math.clamp(rpm / 8_000, 0, 1);

        this.speedNeedle.style.transform = `rotate(${-132 + speedT * 264}deg)`;
        this.rpmNeedle.style.transform = `rotate(${-132 + rpmT * 264}deg)`;
        this.speedValue.textContent = `${Math.round(this.displayedSpeed)}`;
        this.rpmValue.textContent = `${(rpm / 1_000).toFixed(1)}`;
        this.gearValue.textContent = this.getGear(gameSpeed, speedT);
    }

    private getGear(gameSpeed: number, speedT: number) {
        if (gameSpeed < -0.1) return "R";
        if (Math.abs(gameSpeed) < 0.1) return "N";
        return `${Math.min(5, Math.max(1, Math.ceil(speedT * 5)))}`;
    }
}
