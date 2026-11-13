import { clamp } from '../core/util.js';

/**
 * Mission state machine for one night.
 * Owns the objective text, the interaction results and the win/lose
 * checks. Deliberately free of THREE and DOM so it is unit-testable.
 */
export class Mission {
  constructor(game) {
    this.game = game;
    this.stage = 'prologue';       // prologue → house → street → shop → leaving → returnHome → done
    this.productsNeeded = 3;
    this.products = 0;
    this.caught = 0;
    this.enteredShop = false;
  }

  get flags() { return this.game.flags; }

  /* ---------------------------- text ---------------------------- */

  objectiveText() {
    const m = this;
    const g = this.game;
    if (m.stage === 'house') {
      return `Собери деньги в доме · <b>${Math.round(g.player.money)} ₴</b>`;
    }
    if (m.stage === 'street') return 'Дойди до магазина <b>24 ЧАСА</b> через дорогу';
    if (m.stage === 'shop') return `Тихо возьми <b>${m.products}/${m.productsNeeded}</b> товара
      <small>Где искать: хлеб — слева у входа; консервы — слева в середине; чай — слева сзади; молоко — справа в середине; печенье — справа сзади.</small>`;
    if (m.stage === 'leaving') return 'Товар собран — выйди из магазина';
    if (m.stage === 'returnHome') return 'Вернись домой и закрой дверь';
    if (m.stage === 'done') return 'Готово. Отдыхай до следующей ночи.';
    return 'Проснись и осмотрись';
  }

  updateObjective() {
    this.game.hud.setTask(this.objectiveText());
  }

  /* ------------------------ interactions ------------------------ */

  ctxForInteraction() {
    const g = this.game;
    return {
      audio: g.audio,
      flags: g.flags,
      inventory: g.player.inventory,
      hidden: g.player.hidden,
      time: g.time,
      canExitHide: () => g.canExitHide ? g.canExitHide() : true,
      canAddItem: () => g.player.canAddItem ? g.player.canAddItem() : true,
      hasItem: (name) => g.player.hasItem ? g.player.hasItem(name) : g.player.inventory.some((item) => item.name === name),
      addMoney: (v) => { g.player.addMoney(v); g.hud.setMoney(g.player.money); return v; },
      addItem: (name, value = 0, type = 'loot') => {
        const before = g.player.inventory.length;
        const added = g.player.addItem(name, value, type);
        if (added === false || (added === undefined && g.player.inventory.length === before)) return false;
        if (type === 'product') this.products++;
        g.hud.setInventory(g.player.inventory.length, g.player.inventoryCapacity);
        this.updateObjective();
        return true;
      },
    };
  }

  interact(it) {
    if (!it) return null;
    const g = this.game;
    const res = it.onUse(this.ctxForInteraction()) || {};
    if (res.text) g.hud.say(res.text, res.note ? 4.4 : 3.2);
    if (res.money) {
      const alreadyCredited = !!res._credited;
      if (!alreadyCredited) g.player.addMoney(res.money);
      g.hud.setMoney(g.player.money);
      g.hud.toast(`+${res.money} ₴`, 'в кармане', 1.6);
    }
    if (res.pickup) {
      const last = g.player.inventory[g.player.inventory.length - 1];
      g.hud.toast('+1 товар', last ? last.name : '', 1.4);
    }
    if (res.noise) {
      g.noiseLevel = Math.min(1, g.noiseLevel + res.noise);
      g.audio.drawer();
    }
    if (res.event === 'exitHouse') {
      if (!g.flags.leftHouse) {
        g.flags.leftHouse = true;
        this.stage = 'street';
        this.updateObjective();
        g.hud.say('Холодный воздух. Магазин через дорогу, свет горит.', 3.6);
      }
    }
    if (res.event === 'openStorage') g.openStorage?.();
    if (res.event === 'hide') g.enterHide?.();
    if (res.event === 'exitHide') g.exitHide?.();
    if (res.text && it.kind === 'safe') g.audio.coins();
    return res;
  }

  /* --------------------------- progress ------------------------- */

  /** Called every frame while playing. */
  checkProgress() {
    const g = this.game;
    const p = g.player.position;

    // shop entrance: automatic sliding doors
    const dEntrance = Math.hypot(p.x - 3.0, p.z - 14.0);
    if (dEntrance < 3.0 && !g.flags.shopDoorOpen) {
      g.flags.shopDoorOpen = true;
      g.shop.openDoors();
      g.audio.whoosh();
    } else if (dEntrance > 3.6 && g.flags.shopDoorOpen) {
      g.flags.shopDoorOpen = false;
      g.shop.resetDoors();
    }

    // stepping out of the front door
    if (this.stage === 'house' && g.flags.leftHouse && p.z > 2.2) {
      this.stage = 'street';
      this.updateObjective();
    }

    // entering the shop
    if (this.stage === 'street' && p.z > 14.6) {
      this.stage = 'shop';
      this.enteredShop = true;
      this.updateObjective();
      g.hud.toast('МАГАЗИН', 'Тихо. Охранник ходит по залу.', 2.0);
      g.hud.say('Ищи упаковки на полках: хлеб — слева у входа, консервы — слева посередине, чай — слева сзади; молоко и печенье — на правых полках.', 5.2);
    }

    if (this.stage === 'shop' && p.z < 13.4 && this.enteredShop) {
      // walked back out too early: keep the task honest
      g.hud.setTask(`Вернись в магазин · товара <b>${this.products}/${this.productsNeeded}</b>`);
    }

    // all products collected
    if (this.stage === 'shop' && this.products >= this.productsNeeded && !g.flags.productsDone) {
      g.flags.productsDone = true;
      this.stage = 'leaving';
      this.updateObjective();
      g.hud.toast('ТОВАР СОБРАН', 'Осталось выйти незамеченным', 2.2);
      g.hud.say('Три вещи в рюкзаке. Пора уходить.', 2.6);
      g.audio.success();
    }

    // out on the street again
    if (this.stage === 'leaving' && p.z < 13.4) {
      this.stage = 'returnHome';
      this.updateObjective();
      g.hud.say('Почти дома. Не оборачивайся.', 2.6);
    }

    // The home is safe only after the entry door is shut and the player is
    // no longer hiding or being searched for. This makes the close-and-hide
    // actions useful during the return leg instead of ending the night early.
    if (this.stage === 'returnHome' && p.z < 2 && p.z > -8) {
      if (g.flags.houseDoorOpen) {
        g.hud.setTask('Закрой входную дверь — она ещё открыта');
        return null;
      }
      const pursuersSearching = g.guards?.some((guard) => guard.state === 'chase' || guard.state === 'search');
      if (g.player.hidden || pursuersSearching) {
        g.hud.setTask(g.player.hidden
          ? 'Ты спрятался дома — дождись, пока шаги стихнут'
          : 'Погоня не отстала: закрой дверь и спрячься в шкафу');
        return null;
      }
      this.stage = 'done';
      this.updateObjective();
      return 'win';
    }
    return null;
  }

  /** Simple score summary for the end screen. */
  summary() {
    const g = this.game;
    return {
      products: this.products,
      needed: this.productsNeeded,
      money: g.player.money,
      caught: this.caught,
      success: this.stage === 'done',
    };
  }
}
