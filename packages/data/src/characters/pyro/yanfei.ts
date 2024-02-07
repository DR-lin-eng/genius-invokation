import { character, skill, status, card, DamageType, DiceType } from "@gi-tcg/core/builder";

/**
 * @id 113081
 * @name 丹火印
 * @description
 * 角色进行重击时：造成的伤害+2。
 * 可用次数：1（可叠加，最多叠加到2次）
 */
export const ScarletSeal = status(113081)
  .on("modifySkillDamage", (c, e) => e.isSourceSkillType("normal") && c.player.canCharged)
  .usage(1, { recreateMax: 2 })
  .increaseDamage(2)
  .done();

/**
 * @id 113082
 * @name 灼灼
 * @description
 * 角色进行重击时：少花费1个火元素。（每回合1次）
 * 结束阶段：角色附属丹火印。
 * 持续回合：2
 */
export const Brilliance = status(113082)
  .duration(2)
  .on("deductDiceSkill", (c, e) => e.isSkillType("normal") && c.player.canCharged && e.canDeductCostOfType(DiceType.Pyro))
  .usagePerRound(1)
  .deductCost(DiceType.Pyro, 1)
  .on("endPhase")
  .characterStatus(ScarletSeal, "@master")
  .done();

/**
 * @id 13081
 * @name 火漆制印
 * @description
 * 造成1点火元素伤害。
 */
export const SealOfApproval = skill(13081)
  .type("normal")
  .costPyro(1)
  .costVoid(2)
  .damage(DamageType.Pyro, 1)
  .done();

/**
 * @id 13082
 * @name 丹书立约
 * @description
 * 造成3点火元素伤害，本角色附属丹火印。
 */
export const SignedEdict = skill(13082)
  .type("elemental")
  .costPyro(3)
  .damage(DamageType.Pyro, 3)
  .characterStatus(ScarletSeal)
  .done();

/**
 * @id 13083
 * @name 凭此结契
 * @description
 * 造成3点火元素伤害，本角色附属丹火印和灼灼。
 */
export const DoneDeal = skill(13083)
  .type("burst")
  .costPyro(3)
  .costEnergy(2)
  .damage(DamageType.Pyro, 3)
  .characterStatus(ScarletSeal)
  .characterStatus(Brilliance)
  .done();

/**
 * @id 1308
 * @name 烟绯
 * @description
 * 不期修古，不法常可。
 */
export const Yanfei = character(1308)
  .tags("pyro", "catalyst", "liyue")
  .health(10)
  .energy(2)
  .skills(SealOfApproval, SignedEdict, DoneDeal)
  .done();

/**
 * @id 213081
 * @name 最终解释权
 * @description
 * 战斗行动：我方出战角色为烟绯时，装备此牌。
 * 烟绯装备此牌后，立刻使用一次火漆制印。
 * 装备有此牌的烟绯进行重击时：对生命值不多于6的敌人造成的伤害+1；如果触发了丹火印，则在技能结算后抓1张牌。
 * （牌组中包含烟绯，才能加入牌组）
 */
export const RightOfFinalInterpretation = card(213081)
  .costPyro(1)
  .costVoid(2)
  .talent(Yanfei)
  .variable("triggerSeal", 0)
  .on("enter")
  .useSkill(SealOfApproval)
  .on("modifySkillDamage", (c, e) => e.isSourceSkillType("normal") && c.player.canCharged && c.of(e.target).health <= 6)
  .increaseDamage(1)
  .if((c) => c.self.master().hasStatus(ScarletSeal))
  .setVariable("triggerSeal", 1)
  .on("useSkill", (c) => c.getVariable("triggerSeal"))
  .drawCards(1)
  .setVariable("triggerSeal", 0)
  .done();
