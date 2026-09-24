import { esc } from "../../lib/esc.js";
import { showToast } from "../../components/toast.js";
import { supabase } from "../supabase.js";
import {
  deleteAccount,
  signOut,
  updateProfile,
  validateProfile,
  hasProfileErrors,
  type Profile,
} from "../auth.js";
import { AGE_GROUPS, AGE_GROUP_LABELS, RULES_OF_PLAY, isAgeGroup } from "../content/types.js";
import { activeAge, coachedAges } from "../ageChoice.js";
import { ageRulesLink } from "../../lib/rulesLink.js";
import { canInstall, isInstalled, promptInstall, savedForOffline } from "../install.js";

/**
 * `profile` is null for an account that has no usable metadata. Created from the
 * Supabase dashboard, or with its metadata cleared. That coach has to land here
 * and fill the details in, because the age group is what gates the catalogue, so
 * the form doubles as the setup screen rather than guessing an age grade.
 */
export function renderAccount(
  container: HTMLElement,
  profile: Profile | null,
  email: string,
): void {
  // Ticks rather than a single choice. A volunteer with two children often
  // takes two teams. Until this the app could only hold one: the second
  // grade lived in a filter on the drill list that nothing else could see.
  // The list this device holds, not the one in the metadata. They differ by
  // design: the switcher writes locally so it works at a pitch, so the
  // account metadata catches up on the next save. Reading the metadata here
  // would show a coach only the grade they registered with and then drop the
  // one they added, the moment they saved anything at all.
  // Nothing ticked on the setup form. `coachedAges` falls back to the active
  // grade, which is the one key sign-out deliberately leaves alone, so on a
  // club tablet this arrived with the last coach's grade already ticked and
  // savable without a glance.
  const taken = profile ? coachedAges() : [];
  const options = AGE_GROUPS.map(
    (g) =>
      `<label class="age-set-option"><input type="checkbox" name="ageGroups" value="${g}"${
        taken.includes(g) ? " checked" : ""
      } /> ${esc(AGE_GROUP_LABELS[g])}</label>`,
  ).join("");

  container.innerHTML = `
    <div class="account-layout">
    <div class="account-col">
    <section class="hub-panel account-main">
      <h2>${profile ? "Your details" : "Finish setting up"}</h2>
      ${
        profile
          ? ""
          : `<p class="hub-lede">
               A few details first, so the drills you see are ones your players are
               ready for.
             </p>`
      }
      <form id="account-form" novalidate>
        <div class="hub-field">
          <label for="acc-name">Your name</label>
          <input id="acc-name" name="name" type="text" autocomplete="name" maxlength="80" aria-describedby="acc-name-error" value="${esc(profile?.name ?? "")}" />
          <p class="hub-error" id="acc-name-error" role="alert" hidden></p>
        </div>
        <div class="hub-field">
          <label for="acc-club">Rugby club</label>
          <input id="acc-club" name="club" type="text" autocomplete="organization" maxlength="120" aria-describedby="acc-club-error" value="${esc(profile?.club ?? "")}" />
          <p class="hub-error" id="acc-club-error" role="alert" hidden></p>
        </div>
        <fieldset class="age-set" id="acc-age" aria-describedby="acc-age-error">
          <legend>Age groups you coach</legend>
          <p class="hub-fineprint">
            Tick every team you take. You pick which one you are looking at on Drills
            and on Sessions.
          </p>
          <div class="age-set-options">${options}</div>
          <p class="hub-error" id="acc-age-error" role="alert" hidden></p>
          ${taken
            .map(
              (age) =>
                `<p class="hub-fineprint">${ageRulesLink(
                  AGE_GROUP_LABELS[age],
                  RULES_OF_PLAY[age],
                )}</p>`,
            )
            .join("")}
        </fieldset>
        <button type="submit" class="hub-btn hub-btn-primary">
          ${profile ? "Save changes" : "Save and continue"}
        </button>
      </form>
      <p class="hub-fineprint">Signed in as ${esc(email)}.</p>
    </section>

    <section class="hub-panel">
      <h2>Password</h2>
      <form id="password-form" novalidate>
        <div class="hub-field">
          <label for="acc-password">New password</label>
          <input id="acc-password" name="password" type="password" autocomplete="new-password" minlength="8" aria-describedby="acc-password-error" />
          <p class="hub-error" id="acc-password-error" role="alert" hidden></p>
        </div>
        <button type="submit" class="hub-btn">Change password</button>
      </form>
    </section>
    </div>

    <div class="account-side">
    <section class="hub-panel" id="device-panel">
      <h2>On this device</h2>
      ${deviceState()}
    </section>

    <section class="hub-panel">
      <h2>Signing off</h2>
      <button type="button" class="hub-btn" id="sign-out">Sign out</button>
      <p class="hub-fineprint">
        Deleting your account wipes your details and every session plan you have
        saved. There is no undo and no copy kept.
      </p>
      <button type="button" class="hub-btn hub-btn-danger" id="delete-account">
        Delete my account
      </button>
    </section>
    </div>
    </div>`;

  const install = container.querySelector<HTMLButtonElement>("#install-app");
  install?.addEventListener("click", () => {
    install.disabled = true;
    void promptInstall().then((outcome) => {
      if (outcome === "installed") showToast("Added to your home screen.");
      else if (outcome === "dismissed") showToast("No bother. It works in the browser too.");
      else showToast("Your browser has it in its own menu instead.");

      // The whole panel, not just the button. Dropping the button on its own
      // left the copy around it still explaining how to install, underneath a
      // message saying it had just been installed.
      const panel = container.querySelector<HTMLElement>("#device-panel");
      if (panel) {
        panel.innerHTML = `<h2>On this device</h2>${deviceState(outcome === "installed")}`;
      }
    });
  });

  const accountForm = container.querySelector<HTMLFormElement>("#account-form");
  accountForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(accountForm);
    const ageGroups = data.getAll("ageGroups").map(String).filter(isAgeGroup);
    const current = activeAge();
    const fields = {
      name: String(data.get("name") ?? ""),
      club: String(data.get("club") ?? ""),
      // The grade the app stays on where it is still one they take, so saving
      // the form does not move a coach off the team they were working on.
      ageGroup: current && ageGroups.includes(current) ? current : (ageGroups[0] ?? ""),
    };
    const errors = validateProfile(fields);
    showFieldErrors(accountForm, {
      "acc-name": errors.name,
      "acc-club": errors.club,
      "acc-age": errors.ageGroup,
    });
    if (hasProfileErrors(errors)) return;
    const ageGroup = fields.ageGroup;
    if (!isAgeGroup(ageGroup)) return;

    void (async () => {
      try {
        await updateProfile({ name: fields.name, club: fields.club, ageGroup, ageGroups });
        showToast("Saved.");
      } catch (error) {
        showToast(message(error));
      }
    })();
  });

  const passwordForm = container.querySelector<HTMLFormElement>("#password-form");
  passwordForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const password = String(new FormData(passwordForm).get("password") ?? "");
    showFieldErrors(passwordForm, {
      "acc-password": password.length < 8 ? "Eight characters or more, please." : undefined,
    });
    if (password.length < 8) return;

    void (async () => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) showToast(error.message);
      else {
        passwordForm.reset();
        showToast("New password saved.");
      }
    })();
  });

  container.querySelector("#sign-out")?.addEventListener("click", () => {
    void signOut();
  });

  container.querySelector("#delete-account")?.addEventListener("click", () => {
    // Typed confirmation rather than a yes/no. This is irreversible and the
    // button sits one tap away from "sign out"
    const typed = window.prompt(
      'This wipes your account and every session plan for good.\n\nType DELETE to confirm.',
    );
    if (typed !== "DELETE") return;

    void (async () => {
      try {
        await deleteAccount();
        showToast("Account deleted. All the best.");
      } catch (error) {
        showToast(message(error));
      }
    })();
  });
}

function showFieldErrors(
  form: HTMLFormElement,
  errors: Record<string, string | undefined>,
): void {
  for (const [id, text] of Object.entries(errors)) {
    const slot = form.querySelector<HTMLElement>(`#${id}-error`);
    if (!slot) continue;
    slot.textContent = text ?? "";
    slot.hidden = !text;
    form.querySelector(`#${id}`)?.toggleAttribute("aria-invalid", Boolean(text));
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "That didn't work. Give it another go.";
}

/**
 * What this device has, said plainly.
 *
 * Read once at render rather than watched. The account form is on the same
 * screen, so repainting this panel under a coach who is halfway through typing
 * their club name would cost more than a button appearing a visit late.
 */
function deviceState(justInstalled = false): string {
  const offline = savedForOffline()
    ? `<p class="device-state device-state-ready">
         Ready for the pitch. The drills, your sessions and the rules guides are
         all on this device, so they open with no signal.
       </p>`
    : `<p class="device-state">
         Not saved for offline yet. It happens on its own a moment after the app
         opens, so look again in a minute.
       </p>`;

  if (justInstalled) {
    return `${offline}
      <p class="hub-fineprint">
        Added. Open it from your home screen next time for the icon with no
        browser bar around it.
      </p>`;
  }

  if (isInstalled()) {
    return `${offline}
      <p class="hub-fineprint">
        Running from your home screen, which is the way to use it at a pitch.
      </p>`;
  }

  return `${offline}
    <p>
      Adding it to your home screen gives you an icon and no browser bar. It is
      the same app either way, so this is about how it opens rather than what it
      can do.
    </p>
    ${canInstall() ? '<button type="button" class="hub-btn" id="install-app">Add to my home screen</button>' : ""}
    <p class="hub-fineprint">
      No button here? Your browser keeps it in its own menu. On an iPhone that is
      Share, then Add to Home Screen.
    </p>`;
}
