// 解决循环依赖问题
import "./context";

export { character } from "./character";
export { skill } from "./skill";
export { card } from "./card";
export { summon, status, combatStatus } from "./entity";
export {
  beginRegistration,
  endRegistration,
  type ReadonlyDataStore,
} from "./registry";
export type {
  CardHandle,
  CharacterHandle,
  CombatStatusHandle,
  EntityHandle,
  EquipmentHandle,
  SkillHandle,
  StatusHandle,
  SummonHandle,
  SupportHandle,
} from "./type";
export { DiceType, DamageType, Aura } from "@gi-tcg/typings";
export type { CharacterState, EntityState } from "../base/state";

export {
  getReaction,
  isReaction,
  isReactionRelatedTo,
  isReactionSwirl,
} from "./reaction";
export {
  canDeductCostType,
  checkDamageSkillType,
  checkUseDiceSkillType,
  checkCardTag,
} from "./util";
export { flip } from "@gi-tcg/utils";
