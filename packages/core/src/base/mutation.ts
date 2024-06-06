// Copyright (C) 2024 Guyutongxue
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

import { type Draft, produce, enableMapSet } from "immer";

import { DiceType, PhaseType } from "@gi-tcg/typings";
import { flip } from "@gi-tcg/utils";
import {
  CardState,
  CharacterState,
  EntityState,
  GameState,
  PlayerState,
  stringifyState,
} from "./state";
import { removeEntity, getEntityById, sortDice } from "../utils";
import { EntityArea, EntityDefinition, stringifyEntityArea } from "./entity";
import { CharacterDefinition } from "./character";
import { GiTcgCoreInternalError } from "../error";
import { nextRandom } from "../random";

enableMapSet();

type IdWritable<T extends { readonly id: number }> = Omit<T, "id"> & {
  id: number;
};

export interface StepRandomM {
  readonly type: "stepRandom";
  value: number; // output
}

export interface ChangePhaseM {
  readonly type: "changePhase";
  readonly newPhase: PhaseType;
}

export interface StepRoundM {
  readonly type: "stepRound";
}

export interface SwitchTurnM {
  readonly type: "switchTurn";
}

export interface SetWinnerM {
  readonly type: "setWinner";
  readonly winner: 0 | 1;
}

export interface TransferCardM {
  readonly type: "transferCard";
  readonly path: "pilesToHands" | "handsToPiles";
  readonly targetIndex?: number;
  readonly who: 0 | 1;
  readonly value: CardState;
}

export interface SwitchActiveM {
  readonly type: "switchActive";
  readonly who: 0 | 1;
  readonly value: CharacterState;
}

export interface RemoveCardM {
  readonly type: "removeCard";
  readonly who: 0 | 1;
  readonly where: "hands" | "piles";
  readonly used: boolean;
  readonly oldState: CardState;
}

export interface CreateCardM {
  readonly type: "createCard";
  readonly who: 0 | 1;
  readonly value: IdWritable<CardState>;
  readonly target: "hands" | "piles";
  readonly targetIndex?: number;
}

export interface CreateCharacterM {
  readonly type: "createCharacter";
  readonly who: 0 | 1;
  readonly value: IdWritable<CharacterState>;
}

export interface CreateEntityM {
  readonly type: "createEntity";
  readonly where: EntityArea;
  readonly value: IdWritable<EntityState>;
}

export interface RemoveEntityM {
  readonly type: "removeEntity";
  readonly oldState: EntityState | CharacterState;
}

export interface ModifyEntityVarM {
  readonly type: "modifyEntityVar";
  state: EntityState | CharacterState;
  readonly varName: string;
  readonly value: number;
}

export interface TransformDefinitionM {
  readonly type: "transformDefinition";
  state: CharacterState | EntityState;
  readonly newDefinition: CharacterDefinition | EntityDefinition;
}

export interface ResetDiceM {
  readonly type: "resetDice";
  readonly who: 0 | 1;
  readonly value: readonly DiceType[];
}

export type PlayerFlag = {
  [P in keyof PlayerState]: PlayerState[P] extends boolean ? P : never;
}[keyof PlayerState];

export interface SetPlayerFlagM {
  readonly type: "setPlayerFlag";
  readonly who: 0 | 1;
  readonly flagName: PlayerFlag;
  readonly value: boolean;
}

export type ExtraValueName =
  | "disposedSupportCount"
  | "damagedTypeBitset"
  | "azhdahaAbsorbedBitset";
export interface SetPlayerExtraValueM {
  readonly type: "setPlayerExtraValue";
  readonly who: 0 | 1;
  readonly name: ExtraValueName;
  readonly value: number;
}
export interface MutateExtensionStateM {
  readonly type: "mutateExtensionState";
  readonly extensionId: number;
  readonly newState: unknown;
}
export interface MutateRoundSkillLogM {
  readonly type: "mutateRoundSkillLog";
  readonly who: 0 | 1;
  readonly skillIdOrZero: number;
}

export type Mutation =
  | StepRandomM
  | ChangePhaseM
  | StepRoundM
  | SwitchTurnM
  | SetWinnerM
  | TransferCardM
  | SwitchActiveM
  | RemoveCardM
  | CreateCardM
  | CreateCharacterM
  | CreateEntityM
  | RemoveEntityM
  | ModifyEntityVarM
  | TransformDefinitionM
  | ResetDiceM
  | SetPlayerFlagM
  | MutateExtensionStateM
  | MutateRoundSkillLogM;

function doMutation(state: GameState, m: Mutation): GameState {
  switch (m.type) {
    case "stepRandom": {
      const next = nextRandom(state.iterators.random);
      m.value = next;
      return produce(state, (draft) => {
        draft.iterators.random = next;
      });
    }
    case "changePhase": {
      return produce(state, (draft) => {
        draft.phase = m.newPhase;
      });
    }
    case "stepRound": {
      return produce(state, (draft) => {
        draft.roundNumber++;
      });
    }
    case "switchTurn": {
      return produce(state, (draft) => {
        draft.currentTurn = flip(draft.currentTurn);
      });
    }
    case "setWinner": {
      return produce(state, (draft) => {
        draft.winner = m.winner;
      });
    }
    case "transferCard": {
      return produce(state, (draft) => {
        const player = draft.players[m.who];
        const src = m.path === "pilesToHands" ? player.piles : player.hands;
        const dst = m.path === "pilesToHands" ? player.hands : player.piles;
        const cardIdx = src.findIndex((c) => c.id === m.value.id);
        if (cardIdx === -1) {
          throw new GiTcgCoreInternalError(
            `Card ${m.value.id} not found in source`,
          );
        }
        const card = src[cardIdx];
        src.splice(cardIdx, 1);
        if (typeof m.targetIndex === "number") {
          dst.splice(m.targetIndex, 0, card);
        } else {
          dst.push(card);
        }
      });
    }
    case "switchActive": {
      return produce(state, (draft) => {
        const player = draft.players[m.who];
        player.activeCharacterId = m.value.id;
      });
    }
    case "removeCard": {
      return produce(state, (draft) => {
        const player = draft.players[m.who];
        const cardIdx = player[m.where].findIndex(
          (c) => c.id === m.oldState.id,
        );
        if (cardIdx === -1) {
          throw new GiTcgCoreInternalError(
            `Card ${m.oldState.id} not found in ${m.where} of ${m.who}`,
          );
        }
        player[m.where].splice(cardIdx, 1);
      });
    }
    case "createCard": {
      return produce(state, (draft) => {
        m.value.id = draft.iterators.id--;
        const value = m.value as Draft<CardState>;
        const target = draft.players[m.who][m.target];
        if (typeof m.targetIndex === "number") {
          target.splice(m.targetIndex, 0, value);
        } else {
          target.push(value);
        }
      });
    }
    case "createCharacter": {
      return produce(state, (draft) => {
        m.value.id = draft.iterators.id--;
        draft.players[m.who].characters.push(m.value as Draft<CharacterState>);
      });
    }
    case "createEntity": {
      const { where, value } = m;
      if (where.type === "characters") {
        return produce(state, (draft) => {
          const character = draft.players[where.who].characters.find(
            (c) => c.id === where.characterId,
          );
          if (!character) {
            throw new GiTcgCoreInternalError(
              `Character ${where.characterId} not found`,
            );
          }
          value.id = draft.iterators.id--;
          character.entities.push(value as Draft<EntityState>);
        });
      } else {
        return produce(state, (draft) => {
          const area = draft.players[where.who][where.type];
          value.id = draft.iterators.id--;
          area.push(value as Draft<EntityState>);
        });
      }
    }
    case "removeEntity": {
      return produce(state, (draft) => {
        removeEntity(draft, m.oldState.id);
      });
    }
    case "modifyEntityVar": {
      const newState = produce(state, (draft) => {
        const entity = getEntityById(draft, m.state.id, true) as Draft<
          CharacterState | EntityState
        >;
        entity.variables[m.varName] = m.value;
      });
      m.state = getEntityById(newState, m.state.id, true);
      return newState;
    }
    case "transformDefinition": {
      if (m.state.definition.type !== m.newDefinition.type) {
        throw new GiTcgCoreInternalError(
          `Cannot transform definition from different types: ${m.state.definition.type} -> ${m.newDefinition.type}`,
        );
      }
      const newState = produce(state, (draft) => {
        const character = getEntityById(
          draft,
          m.state.id,
          true,
        ) as Draft<CharacterState>;
        character.definition = m.newDefinition as Draft<CharacterDefinition>;
      });
      m.state = getEntityById(newState, m.state.id, true) as CharacterState;
      return newState;
    }
    case "resetDice": {
      return produce(state, (draft) => {
        draft.players[m.who].dice = sortDice(state.players[m.who], m.value);
      });
    }
    case "setPlayerFlag": {
      return produce(state, (draft) => {
        draft.players[m.who][m.flagName] = m.value;
      });
    }
    case "mutateExtensionState": {
      return produce(state, (draft) => {
        const extension = draft.extensions.find(
          (e) => e.definition.id === m.extensionId,
        );
        if (!extension) {
          throw new GiTcgCoreInternalError(
            `Extension ${m.extensionId} not found in state`,
          );
        }
        extension.state = m.newState;
      });
    }
    case "mutateRoundSkillLog": {
      return produce(state, (draft) => {
        if (m.skillIdOrZero) {
          draft.players[m.who].roundSkillLog.push(m.skillIdOrZero);
        } else {
          draft.players[m.who].roundSkillLog = [];
        }
      })
    }
    default: {
      const _: never = m;
      throw new GiTcgCoreInternalError(
        `Unknown mutation type: ${JSON.stringify(m)}`,
      );
    }
  }
}

export function stringifyMutation(m: Mutation): string | null {
  switch (m.type) {
    case "stepRound": {
      return `Step round number`;
    }
    case "switchTurn": {
      return `Switch turn`;
    }
    case "setWinner": {
      return `Set winner to ${m.winner}`;
    }
    case "transferCard": {
      return `Transfer card ${stringifyState(m.value)} ${m.path} of player ${
        m.who
      }`;
    }
    case "switchActive": {
      return `Switch active of player ${m.who} to ${stringifyState(m.value)}`;
    }
    case "removeCard": {
      return `Dispose card ${stringifyState(m.oldState)} of player ${m.who}'s ${
        m.where
      } (${m.used ? "used" : "not used"})`;
    }
    case "createCard": {
      return `Create card ${stringifyState(m.value)} for player ${m.who} in ${
        m.target
      }`;
    }
    case "createCharacter": {
      return `Create character ${stringifyState(m.value)} for player ${m.who}`;
    }
    case "createEntity": {
      return `Create entity ${stringifyState(m.value)} in ${stringifyEntityArea(
        m.where,
      )}`;
    }
    case "removeEntity": {
      return `Removed entity ${stringifyState(m.oldState)}`;
    }
    case "modifyEntityVar": {
      return `Modify variable ${m.varName} of ${stringifyState(m.state)} to ${
        m.value
      }`;
    }
    case "transformDefinition": {
      return `Transform definition of ${stringifyState(
        m.state,
      )} to [${m.newDefinition.type}:${m.newDefinition.id}]`;
    }
    case "resetDice": {
      return `Reset dice of player ${m.who} to ${JSON.stringify(m.value)}`;
    }
    case "setPlayerFlag": {
      return `Set player ${m.who} flag ${m.flagName} to ${m.value}`;
    }
    default: {
      return null;
    }
  }
}

export function applyMutation(state: GameState, m: Mutation): GameState {
  return doMutation(state, m);
}
