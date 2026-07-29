import { getVehicleGear, VehicleDefs } from "../../../shared/defs/vehicleDefs";
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
        const vehicle = VehicleDefs.sportsCar01;
        const gear = getVehicleGear(vehicle, gameSpeed);
        let gearRpmT = speedT;
        if (gear > 0) {
            const gearMinSpeed =
                gear === 1 ? 0 : vehicle.transmission.gearSpeeds[gear - 2];
            const gearMaxSpeed =
                vehicle.transmission.gearSpeeds[gear - 1] ?? vehicle.maxForwardSpeed;
            gearRpmT = math.clamp(
                (gameSpeed - gearMinSpeed) / math.max(gearMaxSpeed - gearMinSpeed, 0.01),
                0,
                1,
            );
        }
        const rpm = 1_100 + gearRpmT * 6_400;
        const gaugeRpmT = math.clamp(rpm / 8_000, 0, 1);

        this.speedNeedle.style.transform = `rotate(${-132 + speedT * 264}deg)`;
        this.rpmNeedle.style.transform = `rotate(${-132 + gaugeRpmT * 264}deg)`;
        this.speedValue.textContent = `${Math.round(this.displayedSpeed)}`;
        this.rpmValue.textContent = `${(rpm / 1_000).toFixed(1)}`;
        this.gearValue.textContent =
            gameSpeed < -0.1 ? "R" : Math.abs(gameSpeed) < 0.1 ? "N" : `${gear}`;
    }
}
