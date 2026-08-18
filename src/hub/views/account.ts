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
import { ageRulesLink } from "../../lib/rulesLink.js";

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
  const options = AGE_GROUPS.map(
    (g) =>
      `<option value="${g}"${g === profile?.ageGroup ? " selected" : ""}>${AGE_GROUP_LABELS[g]}</option>`,
  ).join("");

  container.innerHTML = `
    <section class="hub-panel">
      <h2>${profile ? "Your details" : "Finish setting up"}</h2>
      ${
        profile
          ? ""
          : `<p class="hub-lede">
               A few details first, so the drills you see are ones your players are
               allowed to do.
             </p>`
      }
      <form id="account-form" novalidate>
        <div class="hub-field">
          <label for="acc-name">Your name</label>
          <input id="acc-name" name="name" type="text" maxlength="80" value="${esc(profile?.name ?? "")}" />
          <p class="hub-error" id="acc-name-error" role="alert" hidden></p>
        </div>
        <div class="hub-field">
          <label for="acc-club">Rugby club</label>
          <input id="acc-club" name="club" type="text" maxlength="120" value="${esc(profile?.club ?? "")}" />
          <p class="hub-error" id="acc-club-error" role="alert" hidden></p>
        </div>
        <div class="hub-field">
          <label for="acc-age">Age group you coach</label>
          <select id="acc-age" name="ageGroup">
            ${profile ? "" : '<option value="">Choose…</option>'}${options}
          </select>
          <p class="hub-error" id="acc-age-error" role="alert" hidden></p>
          ${
            profile
              ? `<p class="hub-fineprint">${ageRulesLink(
                  AGE_GROUP_LABELS[profile.ageGroup],
                  RULES_OF_PLAY[profile.ageGroup],
                )}</p>`
              : ""
          }
        </div>
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
          <input id="acc-password" name="password" type="password" autocomplete="new-password" minlength="8" />
          <p class="hub-error" id="acc-password-error" role="alert" hidden></p>
        </div>
        <button type="submit" class="hub-btn">Change password</button>
      </form>
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
    </section>`;

  const accountForm = container.querySelector<HTMLFormElement>("#account-form");
  accountForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(accountForm);
    const fields = {
      name: String(data.get("name") ?? ""),
      club: String(data.get("club") ?? ""),
      ageGroup: String(data.get("ageGroup") ?? ""),
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
        await updateProfile({ name: fields.name, club: fields.club, ageGroup });
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
