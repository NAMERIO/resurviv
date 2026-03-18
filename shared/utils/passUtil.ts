import { PassDefs } from "../defs/gameObjects/passDefs";

const passMaxLevel = 99;

export const passUtil = {
    getPassMaxLevel: function () {
        return passMaxLevel;
    },
    getPassLevelXp: function (passType: string, level: number) {
        const passDef = PassDefs[passType];
        const levelIdx = level - 1;
        if (levelIdx < passDef.xp.length) {
            return passDef.xp[levelIdx];
        }
        return passDef.xp[passDef.xp.length - 1];
    },
    getPassLevelAndXp: function (passType: string, passXp: number) {
        let xp = passXp;
        let level = 1;
        while (level < passMaxLevel) {
            const levelXp = passUtil.getPassLevelXp(passType, level);
            if (xp < levelXp) {
                break;
            }
            xp -= levelXp;
            level++;
        }
        return {
            level,
            xp,
            nextLevelXp: passUtil.getPassLevelXp(passType, level),
        };
    },
    timeUntilQuestRefresh: function (timeAcquired: number) {
        const interval = 5 * 60 * 60 * 1000;
        const offset = 25200000;
        return (
            Math.floor((timeAcquired - offset + interval - 1) / interval) * interval +
            offset -
            Date.now()
        );
    },
    getNextQuestRefreshAt(timeAcquired: number) {
        return timeAcquired + this.timeUntilQuestRefresh(timeAcquired);
    },
};
