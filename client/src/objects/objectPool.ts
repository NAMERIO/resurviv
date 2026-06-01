import type { BitStream } from "../../../shared/net/net";
import {
    type ObjectData,
    type ObjectsPartialData,
    ObjectType,
} from "../../../shared/net/objectSerializeFns";
import { assert } from "../../../shared/utils/util";
import type { Ctx } from "../game";

import type { AbstractObject } from "./player";

type C<T extends AbstractObject> = new () => T;

export class Pool<T extends AbstractObject> {
    m_pool: T[] = [];
    m_freePool: T[] = [];
    m_activeCount = 0;
    m_creator: {
        type: C<T>;
    };

    constructor(classFn: C<T>) {
        this.m_creator = {
            type: classFn,
        };
        assert(classFn !== undefined);
    }

    m_alloc() {
        let obj = this.m_freePool.pop() ?? null;
        while (obj?.active) {
            obj = this.m_freePool.pop() ?? null;
        }
        if (!obj) {
            for (let i = 0; i < this.m_pool.length; i++) {
                if (!this.m_pool[i].active) {
                    obj = this.m_pool[i];
                    break;
                }
            }
            if (!obj) {
                obj = new this.m_creator.type();
                this.m_pool.push(obj);
            }
        }
        obj.active = true;
        obj.m_init();
        this.m_activeCount++;
        return obj;
    }

    m_free(obj: T) {
        obj.m_free();
        obj.active = false;
        this.m_freePool.push(obj);
        this.m_activeCount--;
    }

    m_getPool() {
        return this.m_pool;
    }
}

export class Creator {
    m_idToObj: Record<number, AbstractObject> = {};
    m_types: Record<string, Pool<AbstractObject>> = {};
    m_seenCount = 0;

    m_registerType(type: string, pool: Pool<AbstractObject>) {
        this.m_types[type] = pool;
    }

    m_getObjById(id: number) {
        return this.m_idToObj[id];
    }

    m_getTypeById(id: number, s: BitStream) {
        const obj = this.m_getObjById(id);
        if (!obj) {
            const err = {
                id,
                ids: Object.keys(this.m_idToObj),
                stream: [...s.view.view],
            };
            console.error("objectPoolErr", `getTypeById${JSON.stringify(err)}`);
            return ObjectType.Invalid;
        }
        return obj.__type;
    }

    m_updateObjFull<Type extends ObjectType>(
        type: Type,
        id: number,
        data: ObjectData<Type>,
        ctx: Ctx,
    ) {
        let obj = this.m_getObjById(id);
        let isNew = false;
        if (obj === undefined) {
            obj = this.m_types[type].m_alloc();
            obj.__id = id;
            obj.__type = type;
            this.m_idToObj[id] = obj;
            this.m_seenCount++;
            isNew = true;
        }
        obj.m_updateData(data, true, isNew, ctx);
        return obj;
    }

    m_updateObjPart(id: number, data: ObjectsPartialData[ObjectType], ctx: Ctx) {
        const obj = this.m_getObjById(id);
        if (obj) {
            obj.m_updateData(data, false, false, ctx);
        } else {
            console.error("updateObjPart, missing object", id);
        }
    }

    m_deleteObj(id: number) {
        const obj = this.m_getObjById(id);
        if (obj === undefined) {
            console.error("deleteObj, missing object", id);
        } else {
            this.m_types[obj.__type].m_free(obj);
            delete this.m_idToObj[id];
        }
    }
}
