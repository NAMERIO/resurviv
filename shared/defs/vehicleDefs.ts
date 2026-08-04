import type { Collider } from "../utils/coldet";
import { collider } from "../utils/collider";
import { v2 } from "../utils/v2";

export interface VehicleDef {
    readonly type: "vehicle";
    name: string;
    sprite: string;
    scale: number;
    collision: Collider;
    maxForwardSpeed: number;
    maxReverseSpeed: number;
    acceleration: number;
    braking: number;
    coastingDrag: number;
    interactionRad: number;
    /** Vehicle ignores ground, obstacle, NPC, and player collisions while driven. */
    airborne?: boolean;
    /** Only authenticated developer accounts may enter this vehicle. */
    developerOnly?: boolean;
    /** Driver can aim and use their equipped weapons while mounted. */
    allowDriverWeapons?: boolean;
    /** Uses the mothership's charged cannon instead of the player's weapons. */
    mountedCannon?: boolean;
    /** Whether to display the car speedometer HUD. */
    showHud?: boolean;
    transmission: {
        gearSpeeds: number[];
        highSpeedAccelerationMultiplier: number;
        shiftDuration: number;
        shiftAccelerationMultiplier: number;
    };
    impact: {
        minBreakSpeed: number;
    };
    handling: {
        wheelBase: number;
        lowSpeedSteerAngle: number;
        highSpeedSteerAngle: number;
        steeringResponse: number;
        steeringReturn: number;
        corneringGrip: number;
    };
    drift: {
        minSpeed: number;
        handbrakeEntrySpeedLoss: number;
        handbrakeTurnMultiplier: number;
        handbrakeTraction: number;
        recoveryTraction: number;
        smokeThreshold: number;
    };
    sound: {
        start: string;
        loop: string;
        stop: string;
        brake: string;
        drift: string;
        shift: string;
        burble: string;
    };
}

const sportsCarBase: Omit<VehicleDef, "name" | "sprite" | "collision"> = {
    type: "vehicle",
    scale: 0.55,
    maxForwardSpeed: 26,
    maxReverseSpeed: 9,
    acceleration: 8.5,
    braking: 18,
    coastingDrag: 2.4,
    interactionRad: 1.5,
    transmission: {
        gearSpeeds: [5.5, 10.2, 14.7, 19.5, 26],
        highSpeedAccelerationMultiplier: 0.22,
        shiftDuration: 0.13,
        shiftAccelerationMultiplier: 0.12,
    },
    impact: {
        minBreakSpeed: 1,
    },
    handling: {
        wheelBase: 4.1,
        lowSpeedSteerAngle: 0.58,
        highSpeedSteerAngle: 0.34,
        steeringResponse: 14,
        steeringReturn: 14,
        corneringGrip: 48,
    },
    drift: {
        minSpeed: 4.5,
        handbrakeEntrySpeedLoss: 1.2,
        handbrakeTurnMultiplier: 0.92,
        handbrakeTraction: 3.2,
        recoveryTraction: 34,
        smokeThreshold: 0.22,
    },
    sound: {
        start: "sports_car_engine_start",
        loop: "sports_car_engine_loop",
        stop: "sports_car_engine_stop",
        brake: "sports_car_brake",
        drift: "sports_car_drift",
        shift: "sports_car_exhaust_pop",
        burble: "sports_car_burble",
    },
};

export function getVehicleGear(vehicle: VehicleDef, speed: number) {
    if (speed <= 0.15) return 0;
    const gearIndex = vehicle.transmission.gearSpeeds.findIndex(
        (gearSpeed) => speed <= gearSpeed,
    );
    return gearIndex === -1 ? vehicle.transmission.gearSpeeds.length : gearIndex + 1;
}

function defineSportsCar(name: string, sprite: string, collision: Collider): VehicleDef {
    return {
        ...sportsCarBase,
        name,
        sprite,
        collision,
    };
}

export const VehicleDefs: Record<string, VehicleDef> = {
    motherShip: {
        ...sportsCarBase,
        name: "Alien Mothership",
        sprite: "map-spaceship-01.img",
        scale: 0.5,
        collision: collider.createCircle(v2.create(0, 0), 12),
        maxForwardSpeed: 12,
        maxReverseSpeed: 12,
        acceleration: 11,
        braking: 20,
        coastingDrag: 2,
        interactionRad: 3,
        airborne: true,
        developerOnly: true,
        mountedCannon: true,
        showHud: false,
        transmission: {
            ...sportsCarBase.transmission,
            gearSpeeds: [6, 12, 18, 24, 30],
        },
        impact: { minBreakSpeed: Number.POSITIVE_INFINITY },
        sound: {
            start: "none",
            loop: "mothership_mov_01",
            stop: "none",
            brake: "none",
            drift: "none",
            shift: "none",
            burble: "none",
        },
    },
    sportsCar01: defineSportsCar(
        "Sports Car 01",
        "map-vehicle-sports-car-01.img",
        collider.createPolygon([
            v2.create(3.54, -0.52),
            v2.create(2.3, -1.75),
            v2.create(-2.65, -1.62),
            v2.create(-3.78, -0.58),
            v2.create(-3.78, 0.52),
            v2.create(-2.65, 1.62),
            v2.create(2.3, 1.75),
            v2.create(3.54, 0.52),
        ]),
    ),
    sportsCar03: defineSportsCar(
        "Sports Car 03",
        "map-vehicle-sports-car-03.img",
        collider.createPolygon([
            v2.create(0.99, 1.71),
            v2.create(3.01, 1.13),
            v2.create(3.49, -0.14),
            v2.create(3.08, -1.16),
            v2.create(1.06, -1.64),
            v2.create(-2.43, -1.44),
            v2.create(-3.28, -0.99),
            v2.create(-3.42, 0.75),
            v2.create(-3.11, 1.23),
            v2.create(-2.29, 1.5),
        ]),
    ),
    sportsCar04: defineSportsCar(
        "Sports Car 04",
        "map-vehicle-sports-car-04.img",
        collider.createPolygon([
            v2.create(2.84, 1.54),
            v2.create(3.49, 1.13),
            v2.create(3.69, -0.44),
            v2.create(3.18, -1.33),
            v2.create(2.26, -1.64),
            v2.create(-3.15, -1.47),
            v2.create(-3.69, -0.38),
            v2.create(-3.52, 0.99),
            v2.create(-2.6, 1.71),
            v2.create(0.99, 1.78),
        ]),
    ),
};
