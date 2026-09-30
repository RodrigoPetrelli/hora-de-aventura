// Billy, the greatest hero of Ooo (retired): the quest that starts the adventure. He waits in front of
// the Tree Fort and first tests Finn (five slimes, any way they pop: sword, stomp, Jake, fire); then he
// sends him after the three boss diamonds (crystals.js: the code calls them crystals) and every golden
// crystal around Ooo (the treasures, where they always were) and leaps off to the Temple of the
// Enchiridion, where he waits by the door. With all of them, talking to him opens it (temple.js). The Ice King
// only offers his quest once Billy has sent Finn off (the start of the boss chain).
// Progress lives in save.billy = { q, kills }: q is none | slimes | back | crystals | won, kills the
// slimes popped for his test.
import { TEMPLE } from "./temple.js";
import { STR } from "./strings.js";

export const BILLY_KILLS = 5;
/** Billy has sent Finn after the crystals (the bosses' quests are open). */
export const billyOpen = (save) => save.billy.q === "crystals" || save.billy.q === "won";

/**
 * api (main.js): save, writeSave(), player, npc (Billy's npc record), toast(html, secs), sfx, burst(...),
 * diamonds() / totalD (the boss diamonds Finn has / there are), gems() / totalGems (the golden crystals
 * found / there are), templeOpen() / openTemple() (the door),
 * bookTaken(), jakeSay(text), news() (the journal changed), after() (the objective once his quest is done:
 * the Lich's, lich.js).
 */
export function createBilly(scene, api) {
  const S = api.save.billy, n = api.npc;
  const home = { x: n.x, y: n.y, z: n.z, yaw: n.baseYaw };
  // by the temple door (it faces west), just off its axis between the columns, looking out the way Finn comes
  const at = () => ({ x: TEMPLE.x - 8.4, y: TEMPLE.y, z: TEMPLE.z + 2.6, yaw: -Math.PI / 2 });
  let leap = -1; // seconds into his leap off to the temple (-1: not leaping)
  const complete = () => api.diamonds() >= api.totalD && api.gems() >= api.totalGems;

  function put(p) {
    n.x = p.x; n.y = p.y; n.z = p.z;
    n.baseYaw = p.yaw;
    n.model.position.set(p.x, p.y, p.z);
    n.model.rotation.y = p.yaw;
    n.model.scale.set(1, 1, 1);
    n.shadow?.position.set(p.x, p.y + 0.03, p.z);
    n.busy = false;
  }
  if (billyOpen(api.save)) put(at());

  function goal() {
    const text = S.q === "slimes" ? STR.billy.goalSlimes(S.kills, BILLY_KILLS) : S.q === "back" ? STR.billy.goalBack
      : S.q === "crystals" ? (complete() ? STR.billy.goalTemple : STR.billy.goalCrystals(api.diamonds(), api.totalD, api.gems(), api.totalGems))
      : S.q === "won" ? api.after?.() || "" : "";
    const el = document.getElementById("quest0");
    el.hidden = !text;
    document.getElementById("quest0Text").textContent = text;
  }
  goal();

  return {
    /** What he says, by quest step. */
    lines() {
      if (S.q === "none") return STR.billy.offer;
      if (S.q === "slimes") return [STR.billy.progress(BILLY_KILLS - S.kills), STR.billy.hint, STR.billy.tip];
      if (S.q === "back") return STR.billy.proud;
      if (S.q === "crystals") {
        if (complete()) return STR.billy.ready;
        const left = api.totalGems - api.gems();
        return [STR.billy.waiting, STR.billy.where[api.diamonds()], left ? STR.billy.left(left) : STR.billy.allGems, STR.billy.need];
      }
      return api.bookTaken() ? STR.billy.done : STR.billy.after;
    },
    /** After a talk with him: the quest moves on (he leaps off to the temple, or opens its door). */
    afterTalk() {
      if (S.q === "none") {
        S.q = "slimes";
        S.kills = 0;
        api.toast(STR.billy.accepted, 5);
      } else if (S.q === "back") {
        S.q = "crystals";
        leap = 0;
        n.busy = true;
        api.toast(STR.billy.crystals, 7);
        api.news();
      } else if (S.q === "crystals" && complete()) {
        S.q = "won";
        if (!api.templeOpen()) api.openTemple();
      } else return;
      api.writeSave();
      goal();
    },
    /** A slime popped (main.js): it counts for his test. */
    kill() {
      if (S.q !== "slimes") return;
      S.kills++;
      api.sfx("heal");
      if (S.kills >= BILLY_KILLS) {
        S.q = "back";
        api.toast(STR.billy.allKilled, 5);
        api.news();
      } else api.toast(STR.billy.killed(S.kills, BILLY_KILLS));
      api.writeSave();
      goal();
    },
    /** A diamond or a crystal came in (the objective box counts them). */
    refresh: goal,
    /** Everything the door needs, while he's waiting for it. */
    ready: () => S.q === "crystals" && complete(),
    /** New game: back in front of the Tree Fort. */
    reset() {
      leap = -1;
      put(home);
      goal();
    },
    update(dt) {
      if (leap < 0) return;
      // crouch, then a hero's leap up into the sky; he lands by the temple door (out of sight)
      leap += dt;
      const m = n.model;
      if (leap < 0.4) m.scale.set(1 + 0.08 * Math.sin((leap / 0.4) * Math.PI / 2), 1 - 0.16 * Math.sin((leap / 0.4) * Math.PI / 2), 1);
      else {
        const u = leap - 0.4;
        if (u - dt < 0) {
          m.scale.set(1, 1, 1);
          api.burst(n.x, n.y + 0.3, n.z, 30, [0xffffff, 0xd8e8e6, 0x9fb4b1], 7, 8, 0.4, 1);
          api.sfx("whoosh");
          api.jakeSay(STR.jake.billyLeap);
        }
        m.position.y = n.y + 40 * u + 10 * u * u;
      }
      if (leap > 1.6) {
        leap = -1;
        put(at());
        api.toast(STR.billy.leapt, 5);
      }
    },
    /** Dots for the minimap: fn(x, z, color); slimes: where the live ones are (his test). */
    dots(fn, slimes) {
      if (S.q === "slimes") for (const e of slimes) if (!e.dead && e.st !== "dying") fn(e.x, e.z, "#7ed957");
      if (S.q === "back" || (S.q === "crystals" && complete())) fn(n.x, n.z, "#ffd23f");
    },
  };
}
