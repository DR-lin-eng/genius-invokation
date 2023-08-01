import { DamageData, DamageType } from "@gi-tcg/typings";
import { CharacterPath, heal } from "./character.js";
import { AllEntityState, EntityPath } from "./entity.js";
import { PlayerIO } from "./io.js";
import { PlayerMutator } from "./player.js";
import {
  Store,
  findCharacter,
  findEntity,
  getCharacterAtPath,
  getEntityAtPath,
} from "./store.js";
import { AnyEventDescriptor, DamageContextImpl } from "./context.js";
import {
  AsyncEventMap,
  Context,
  DamageContext,
  SyncEventMap,
  SyncHandlerResult,
  makeReactionFromDamage,
} from "@gi-tcg/data";
import { Damage, DamageLogType } from "./damage.js";
import { flip } from "@gi-tcg/utils";
import { Draft } from "immer";

export class Mutator {
  readonly players: readonly [PlayerMutator, PlayerMutator];

  constructor(
    private store: Store,
    private playerIO: readonly [PlayerIO | null, PlayerIO | null],
  ) {
    this.players = [
      new PlayerMutator(store, 0, playerIO[0]),
      new PlayerMutator(store, 1, playerIO[1]),
    ];
  }

  private doElementalReaction(damageCtx: Context<never, DamageContext, true>) {
    const [newAura, reaction] = makeReactionFromDamage(damageCtx);
    damageCtx.target.character.applied = newAura;
    if (reaction !== null) {
      this.emitEvent(
        "onElementalReaction",
        damageCtx.who,
        damageCtx.sourceId,
        reaction,
      );
      this.store._produce((draft) => {
        draft.skillReactionLog.push(reaction);
      });
    }
  }

  dealDamage(
    source: EntityPath,
    target: CharacterPath,
    value: number,
    type: DamageType,
  ) {
    const damage = new Damage(source, target, value, type);
    const dmgCtx = new DamageContextImpl(this.store, source, damage);
    this.doElementalReaction(dmgCtx);
    this.emitImmediatelyHandledEvent(
      "onEarlyBeforeDealDamage",
      damage,
      who,
      targetWho,
      master,
    );
    const changedType = damage.getType();
    if (changedType !== DamageType.Piercing) {
      this.emitImmediatelyHandledEvent(
        "onBeforeDealDamage",
        damage,
        who,
        targetWho,
        master,
      );
      if (source.type === "skill") {
        this.emitImmediatelyHandledEvent(
          "onBeforeSkillDamage",
          damage,
          who,
          targetWho,
          master,
        );
      }
      this.emitImmediatelyHandledEvent(
        "onBeforeDamaged",
        damage,
        who,
        targetWho,
        master,
      );
    }
    target.health -= damage.getValue();
    if (target.health < 0) {
      target.health = 0;
    }
    this.emitEvent("onDamaged", damage, who, targetWho, master);
    this.store._produce((draft) => {
      draft.skillDamageLog.push(damage.toLogType() as Draft<DamageLogType>);
    });
    const ioData = damage.toData();
    this.playerIO[0]?.notifyMe({ type: "stateUpdated", damages: [ioData] });
    this.playerIO[1]?.notifyMe({ type: "stateUpdated", damages: [ioData] });
  }

  heal(source: EntityPath, target: CharacterPath, value: number) {
    const oldHealth = getCharacterAtPath(this.store.state, target).health;
    this.store.updateCharacterAtPath(target, (ch) => heal(ch, value));
    const newHealth = getCharacterAtPath(this.store.state, target).health;
    const diff = newHealth - oldHealth;
    const damageLog: DamageData = {
      target: target.entityId,
      value: diff,
      type: DamageType.Heal,
      log: [
        {
          source: JSON.stringify(source),
          what: `Heal ${value}(${diff}) HP`,
        },
      ],
    };
    this.playerIO[0]?.notifyMe({ type: "stateUpdated", damages: [damageLog] });
    this.playerIO[1]?.notifyMe({ type: "stateUpdated", damages: [damageLog] });
  }

  cleanSkillLog() {
    this.store._produce((draft) => {
      draft.skillDamageLog = [];
      draft.skillReactionLog = [];
    });
  }

  applyElement(source: EntityPath, target: CharacterPath, type: DamageType) {
    if (
      !(
        type === DamageType.Cryo ||
        type === DamageType.Hydro ||
        type === DamageType.Electro ||
        type === DamageType.Pyro ||
        type === DamageType.Dendro
      )
    ) {
      throw new Error(`Invalid applied element type ${type}`);
    }
    const pseudoDamage = new Damage(source, target, 0, type);
    const ctx = new DamageContextImpl(this.store, this.source, pseudoDamage);
    this.doElementalReaction();
    // TODO
  }

  private checkDispose() {
    const playerSeq = [
      this.store.state.currentTurn,
      flip(this.store.state.currentTurn),
    ];
    this.store._produce((draft) => {
      for (const idx of playerSeq) {
        const player = draft.players[idx];
        const activeIndex = player.characters.findIndex(
          (ch) => ch.entityId === player.active?.entityId,
        );
        for (let i = 0; i < player.characters.length; i++) {
          const character =
            player.characters[(activeIndex + i) % player.characters.length];
          for (let j = 0; j < character.statuses.length; j++) {
            if (character.statuses[j].shouldDispose) {
              character.statuses.splice(j, 1);
              j--;
            }
          }
        }
        for (let i = 0; i < player.combatStatuses.length; i++) {
          if (player.combatStatuses[i].shouldDispose) {
            player.combatStatuses.splice(i, 1);
            i--;
          }
        }
        for (let i = 0; i < player.summons.length; i++) {
          if (player.summons[i].shouldDispose) {
            player.summons.splice(i, 1);
            i--;
          }
        }
        for (let i = 0; i < player.supports.length; i++) {
          if (player.supports[i].shouldDispose) {
            player.supports.splice(i, 1);
            i--;
          }
        }
      }
    });
  }

  private receiveEvent(
    target: EntityPath,
    d: AnyEventDescriptor,
    async?: false,
  ): void;
  private receiveEvent(
    target: EntityPath,
    d: AnyEventDescriptor,
    async: true,
  ): Promise<void>;
  private receiveEvent(
    target: EntityPath,
    [e, ctxFactory]: AnyEventDescriptor,
    async = false,
  ): void | Promise<void> {
    if (e === "onActionPhase") {
      this.store.updateEntityAtPath(target, (draft) => {
        draft.duration--;
        if (draft.duration <= 0) {
          draft.shouldDispose = true;
        } else if ("usagePerRound" in draft.info) {
          draft.usagePerRound = draft.info.usagePerRound;
        }
      });
    }
    const ctx = ctxFactory(this.store, target);
    const entity = getEntityAtPath(this.store.state, target);
    const h = entity.info.handler.handler[e];
    if (
      ctx === null ||
      typeof h === "undefined" ||
      entity.shouldDispose ||
      entity.usagePerRound <= 0
    ) {
      return;
    }
    const postOp = (result: SyncHandlerResult) => {
      if (typeof result === "undefined" || result === true) {
        this.store.updateEntityAtPath(target, (draft) => {
          draft.usage--;
          draft.usagePerRound--;
          if (draft.usage <= 0) {
            draft.shouldDispose = true;
          }
        });
      }
    };
    if (async) {
      return (async () => await h(ctx as any))().then(postOp);
    } else {
      const result = h(ctx as any);
      if (typeof result === "object" && "then" in result) {
        throw new Error("Cannot handle async event in sync mode");
      }
      postOp(result);
    }
  }

  private propagateSyncEvent(ed: AnyEventDescriptor): void {
    const playerSeq = [
      this.store.state.currentTurn,
      flip(this.store.state.currentTurn),
    ];
    for (const idx of playerSeq) {
      for (const [, chPath] of findCharacter(this.store.state, idx)) {
        for (const type of ["passive_skill", "equipment", "status"] as const) {
          for (const [, path] of findEntity(this.store.state, chPath, type)) {
            this.receiveEvent(path, ed);
          }
        }
      }
      for (const type of ["status", "summon", "support"] as const) {
        for (const [, path] of findEntity(this.store.state, idx, type)) {
          this.receiveEvent(path, ed);
        }
      }
    }
  }

  private async *propagateAsyncEvent(ed: AnyEventDescriptor) {
    const playerSeq = [
      this.store.state.currentTurn,
      flip(this.store.state.currentTurn),
    ];
    for (const idx of playerSeq) {
      for (const [, chPath] of findCharacter(this.store.state, idx)) {
        for (const type of ["passive_skill", "equipment", "status"] as const) {
          for (const [, path] of findEntity(this.store.state, chPath, type)) {
            await this.receiveEvent(path, ed, true);
            yield;
          }
        }
      }
      for (const type of ["status", "summon", "support"] as const) {
        for (const [, path] of findEntity(this.store.state, idx, type)) {
          await this.receiveEvent(path, ed, true);
          yield;
        }
      }
    }
  }

  emitEvent<E extends keyof AsyncEventMap>(e: E) {
    // TODO
  }
  emitSyncEvent<E extends keyof SyncEventMap>(e: E) {

  }
}
