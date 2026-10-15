**Damarın olduğu yeri kazar. Başka yere kazma vurmaz.**

<!-- Absolute URL on purpose: npm does not rewrite relative image paths. -->
<img src="https://raw.githubusercontent.com/erayendes/madenci/main/assets/madenci.png" alt="madenci" width="520">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Yerli üretim](https://img.shields.io/badge/YERL%C4%B0%20%C3%9CRET%C4%B0M-red?style=flat&label=%F0%9F%A4%9D&color=red&link=https%3A%2F%2Fmilowda.com)](https://milowda.com)

🇹🇷 [Türkçe](#madenci) · 🇬🇧 [English](#english)

---

# madenci

Ona altın kazmasını söylersin, damara gider. Yeni bir maden açmaz, dağı baştan aşağı
delmez, istemediğin taşı taşımaz. Çünkü o Age of Empires II'deki **madencidir** ve her kazma
darbesi bir sonraki kişinin okuyacağı, test edeceği, düzelteceği bir satırdır.

Madenci ajanın **yazdığı kodu** yönetir: görevi çözen en küçük tam değişiklik.

## Ne yapar

İlk işe yarayan seçeneği alır:

1. **Gerçekten gerekli mi?** İstenmeyen özellik, seçenek, esneklik yok.
2. **Kod tabanında zaten var mı?** Varsa onu, çevresindeki kodun kullandığı gibi kullanır.
3. **Standart kütüphane veya platform yapıyor mu?** Onu kullanır.
4. **Kurulu bir bağımlılık var mı?** Onu kullanır. Üç satır için yeni bağımlılık eklemez.
5. **Tek satırda okunur mu?** Tek satır.
6. **Hiçbiri değilse:** çalışan en az kod.

Soyutlama, sarmalayıcı, "ileride lazım olur" kodu yok. Ama tembellik çözümde, değişikliğin
kendisinde değil: kırdığı çağıranlar, testler, fixture'lar tamamlanır.

**Asla kesilmez:** güven sınırındaki doğrulama, veri kaybını önleyen hata yönetimi, güvenlik,
erişilebilirlik, açıkça istenen her şey.

Bilinen bir sınırı olan kestirme kodda işaretlenir:

```js
// shortcut: tek süreçte doğru, birden fazla worker'da kilit gerekir
```

`/madenci debt` bunları toplar; ertelenen iş sessizce kalıcı olmaz.

## Kullanım

```
/madenci kalk               # aç (varsayılan: açık, full)
/madenci yat                # kapat
/madenci lite|full|ultra    # seviye
/madenci debt               # tüm shortcut: işaretlerinin borç listesi
/madenci audit              # depo denetimi: hata, risk, ölçek, silinecek kod
/madenci help               # komutlar ve mevcut durum
```

| Seviye | Davranış |
|---|---|
| `lite` | İsteneni yapar, daha küçük seçeneği tek satırda söyler, seçimi sana bırakır. |
| `full` | Kuralların tamamı. Varsayılan. |
| `ultra` | İsteği de sorgular: ihtiyacın haklı çıkarmadığı kısma yapmadan önce itiraz eder. |

`debt` ve `audit` mod değil, rapor: çalışır, teslim eder, koda dokunmaz.

## oduncu ile

[oduncu](https://github.com/erayendes/oduncu) sohbeti yönetir, madenci kodu. Biri az
konuşur, öteki az kazar; ikisi birlikte çalışır. Oduncu açıkken madenci'nin kapanış notu
("şunu atladım") düşer — sorarsan cevap gelir. Gerçek bir risk (veri kaybı, güvenlik) yine
tek satırla söylenir.

## Kurulum

Claude Code'da plugin olarak — hook'larla birlikte, önerilen yol:

```
/plugin marketplace add erayendes/madenci
/plugin install madenci@madenci
```

Hook'lar madenciyi oturumlar arasında açık tutar ve alt ajanlara da ulaştırır. Diğer ajanlar
için yalnızca skill:

```bash
npx madenci install                     # bulduğu her ajana
npx madenci install --only claude,codex # seçerek
npx madenci install --dry-run           # ne olacağını göster
npx madenci where                       # yollar ve mevcut durum
npx madenci uninstall                   # her yerden kaldır
```

`npm i` sırasında hiçbir şey yazılmaz; ev dizinine dokunan bir `postinstall` yok.

| Ajan | Global skill klasörü |
|---|---|
| Claude Code | `~/.claude/skills/` |
| Codex | `~/.codex/skills/` |
| Antigravity | `~/.gemini/config/skills/` |
| Gemini CLI | `~/.gemini/skills/` |
| Cursor | `~/.cursor/skills/` |
| Agent Skills standardı | `~/.agents/skills/` |

Hook'suz kurulumda madenci oturum boyunca açık kalır ama alt ajanlara ulaşmaz.

## Hook'lar ne yapar

Üç hook, tek dosya ([`hooks/madenci.js`](hooks/madenci.js), ~100 satır). Ağa çıkmaz.
Yalnızca bir durum dosyasını okur/yazar: `~/.config/madenci/state.json` (Windows'ta
`%APPDATA%\madenci\`).

- **SessionStart:** madenci açıksa kuralları context'e ekler.
- **SubagentStart:** aynısını her alt ajana.
- **UserPromptSubmit:** `/madenci kalk|yat|lite|full|ultra` komutlarını durum dosyasına yazar.
  Başka hiçbir mesaja tepki vermez.

## Teşekkür

Madenci, [ponytail](https://github.com/DietrichGebert/ponytail)'den (MIT, © DietrichGebert)
türetildi. Kural seti, `debt` ve `audit` oradan geliyor; madenci onları budadı, tek skill ve
tek hook dosyasına indirdi, oduncu ile birlikte çalışacak hale getirdi.

---

# English

Tell it to mine gold and it goes to the vein. It doesn't open a new shaft, doesn't drill the
mountain top to bottom, doesn't haul stone nobody ordered. It is the **miner** from Age of
Empires II, and every swing of the pick is a line someone will later read, test and fix.

madenci governs the **code** an agent writes: the smallest complete change that solves the task.

## What it does

It takes the first option that fully works:

1. **Does it need to exist?** No unrequested features, options or flexibility.
2. **Already in the codebase?** Use it, the way the surrounding code does.
3. **Stdlib or platform?** Use it.
4. **An installed dependency?** Use it. Never a new dependency for three lines.
5. **One readable line?** One line.
6. **Otherwise:** the minimum code that works.

No abstractions, wrappers or "for later" code. But the laziness is in the solution, never in
the change: the callers, tests and fixtures it breaks get finished.

**Never cut:** validation at trust boundaries, error handling that prevents data loss,
security, accessibility, anything explicitly asked for.

A shortcut with a known limit is marked in the code — `shortcut: <limit>, <when to upgrade>` —
and `/madenci debt` collects them, so a deferral never quietly becomes permanent.

## Usage

```
/madenci kalk               # on (default: on, full)
/madenci yat                # off
/madenci lite|full|ultra    # level
/madenci debt               # ledger of every shortcut: marker
/madenci audit              # repo audit: bugs, risk, scale, code to delete
/madenci help               # commands and current state
```

| Level | Behavior |
|---|---|
| `lite` | Builds what was asked, names the smaller option in one line, lets you pick. |
| `full` | All the rules. Default. |
| `ultra` | Also questions the request: pushes back on any part the need doesn't justify. |

`debt` and `audit` are reports, not modes: they run, deliver, and change no code.

## With oduncu

[oduncu](https://github.com/erayendes/oduncu) governs the chat, madenci the code. One talks
little, the other digs little; they stack. While oduncu is on, madenci's closing note ("skipped
X") is dropped — ask and you get it. A real risk (data loss, security) is still said in one line.

## Install

As a Claude Code plugin, with hooks — the recommended path:

```
/plugin marketplace add erayendes/madenci
/plugin install madenci@madenci
```

The hooks keep madenci on across sessions and carry it into subagents. Skill only, for every
other agent:

```bash
npx madenci install                     # every agent found
npx madenci install --only claude,codex # pick
npx madenci install --dry-run           # show what would happen
npx madenci where                       # paths and current state
npx madenci uninstall                   # remove everywhere
```

Nothing is written during `npm i` — there is no `postinstall` touching your home directory.
Without hooks, madenci stays on for the session but does not reach subagents.

## What the hooks do

Three hooks, one file ([`hooks/madenci.js`](hooks/madenci.js), ~100 lines). No network. They
read and write one state file: `~/.config/madenci/state.json` (`%APPDATA%\madenci\` on Windows).

- **SessionStart:** if madenci is on, adds the rules to context.
- **SubagentStart:** the same, for every subagent.
- **UserPromptSubmit:** records `/madenci kalk|yat|lite|full|ultra` in the state file. Reacts to
  nothing else.

## Credit

madenci is derived from [ponytail](https://github.com/DietrichGebert/ponytail) (MIT,
© DietrichGebert). The ruleset, `debt` and `audit` come from there; madenci pruned them down to
one skill and one hook file, and made them work alongside oduncu.
