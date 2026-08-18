import { chosenAge } from "../ageChoice.js";
import { track } from "../../lib/track.js";
import { esc } from "../../lib/esc.js";
import { showToast } from "../../components/toast.js";
import {
  signIn,
  signUp,
  sendPasswordReset,
  validateCredentials,
  validateProfile,
  hasProfileErrors,
  type ProfileErrors,
} from "../auth.js";
import { AGE_GROUPS, AGE_GROUP_LABELS, isAgeGroup } from "../content/types.js";

type Mode = "signin" | "signup" | "reset";

/** Prefilled from the picker, so nobody is asked their age grade twice. */
function ageOptions(): string {
  const already = chosenAge();
  return AGE_GROUPS.map(
    (g) => `<option value="${g}"${g === already ? " selected" : ""}>${AGE_GROUP_LABELS[g]}</option>`,
  ).join("");
}

function field(
  id: string,
  label: string,
  input: string,
): string {
  return `
    <div class="hub-field">
      <label for="${id}">${esc(label)}</label>
      ${input}
      <p class="hub-error" id="${id}-error" role="alert" hidden></p>
    </div>`;
}

/**
 * One password field with a reveal, rather than a confirm field.
 *
 * The button says what it will do rather than what the state is, which is the
 * bit people get wrong. It is a real button so it is reachable by keyboard.
 */
function passwordField(label: string, autocomplete: string, extra = ""): string {
  return `
    <div class="hub-field">
      <label for="password">${esc(label)}</label>
      <div class="hub-password">
        <input id="password" name="password" type="password" autocomplete="${autocomplete}"${extra} required aria-describedby="password-error" />
        <button type="button" class="hub-reveal" id="reveal-password">Show</button>
      </div>
      <p class="hub-error" id="password-error" role="alert" hidden></p>
    </div>`;
}

function signInForm(): string {
  return `
    <h2>Sign in</h2>
    <p class="hub-lede">Your drills and your session plans.</p>
    <form id="auth-form" novalidate>
      ${field("email", "Email", `<input id="email" name="email" type="email" autocomplete="email" required aria-describedby="email-error" />`)}
      ${passwordField("Password", "current-password")}
      <button type="submit" class="hub-btn hub-btn-primary">Sign in</button>
    </form>
    <p class="hub-switch">
      <button type="button" class="hub-link" data-mode="reset">Forgotten your password?</button>
    </p>
    <p class="hub-switch">
      First time? <button type="button" class="hub-link" data-mode="signup">Create an account</button>
    </p>`;
}

function signUpForm(): string {
  return `
    <h2>Create your account</h2>
    <p class="hub-lede">
      It costs nothing. We ask for your club and age grade so you only ever see the
      rugby drills your players are actually allowed to do.
    </p>
    <form id="auth-form" novalidate>
      ${field("name", "Your name", `<input id="name" name="name" type="text" autocomplete="name" maxlength="80" required aria-describedby="name-error" />`)}
      ${field("email", "Email", `<input id="email" name="email" type="email" autocomplete="email" required aria-describedby="email-error" />`)}
      ${passwordField("Password", "new-password", ' minlength="8"')}
      ${field("club", "Rugby club", `<input id="club" name="club" type="text" autocomplete="organization" maxlength="120" required aria-describedby="club-error" />`)}
      ${field("ageGroup", "Age group you coach", `<select id="ageGroup" name="ageGroup" class="hub-input-short" required aria-describedby="ageGroup-error"><option value="">Choose…</option>${ageOptions()}</select>`)}
      <button type="submit" class="hub-btn hub-btn-primary">Create account</button>
    </form>
    <p class="hub-fineprint">
      We keep your name, email, club and age group. Nothing about any child, ever.
      The <a href="/privacy">privacy notice</a> spells it out.
    </p>
    <p class="hub-switch">
      Already registered? <button type="button" class="hub-link" data-mode="signin">Sign in</button>
    </p>`;
}

function resetForm(): string {
  return `
    <h2>Reset your password</h2>
    <p class="hub-lede">
      We'll email you a link. Open it on this device in this browser, because for
      security it won't work anywhere else.
    </p>
    <form id="auth-form" novalidate>
      ${field("email", "Email", `<input id="email" name="email" type="email" autocomplete="email" required aria-describedby="email-error" />`)}
      <button type="submit" class="hub-btn hub-btn-primary">Send reset link</button>
    </form>
    <p class="hub-switch">
      <button type="button" class="hub-link" data-mode="signin">Back to sign in</button>
    </p>`;
}

function showErrors(form: HTMLFormElement, errors: ProfileErrors): void {
  for (const el of form.querySelectorAll<HTMLElement>(".hub-error")) {
    el.hidden = true;
    el.textContent = "";
  }
  // Clear the previous round too, or a corrected field keeps announcing itself as
  // invalid with no message attached
  for (const input of form.querySelectorAll<HTMLElement>("[aria-invalid]")) {
    input.removeAttribute("aria-invalid");
  }
  let first: HTMLElement | null = null;
  for (const [key, message] of Object.entries(errors)) {
    const slot = form.querySelector<HTMLElement>(`#${key}-error`);
    const input = form.querySelector<HTMLElement>(`#${key}`);
    if (slot) {
      slot.textContent = message;
      slot.hidden = false;
    }
    input?.setAttribute("aria-invalid", "true");
    if (!first) first = input;
  }
  first?.focus();
}

/**
 * `reason` is what the coach was reaching for when they got here. A gate that
 * says what registering buys converts better than one that just blocks. It is
 * also the honest thing to put in front of somebody. See `docs/one-product.md`.
 */
/**
 * What an account is for, in the space the form does not need.
 *
 * A capped form on a wide screen leaves a column of nothing beside it. This is
 * the reassurance a coach wants before handing over an email address, so it is
 * the right thing to put there. Below the form on a phone.
 */
function aside(): string {
  return `
    <aside class="hub-auth-aside">
      <h3>What you are signing up to</h3>
      <p><strong>Nothing about a child is stored.</strong> Not names, not notes, not
      photographs. Player names never leave the phone in your pocket.</p>
      <p><strong>Your age grade decides what you see.</strong> A ruck drill cannot turn
      up in a U8 session. There is no setting that lets one through.</p>
      <p><strong>It keeps working with no signal.</strong> What you type is saved on your
      phone straight away. It reaches your account later, whenever there is a signal.</p>
      <p class="hub-auth-aside-foot">The match-day planner stays free without any of
      this. <a href="/planner">Open it here</a>.</p>
    </aside>`;
}

export function renderAuth(
  container: HTMLElement,
  initialMode: Mode = "signin",
  reason = "",
): void {
  let mode: Mode = initialMode;

  function draw(): void {
    container.innerHTML = `
      <div class="hub-auth-layout">
        <section class="hub-auth">${
          reason ? `<p class="hub-gate">${esc(reason)}</p>` : ""
        }${mode === "signup" ? signUpForm() : mode === "reset" ? resetForm() : signInForm()}</section>
        ${aside()}
      </div>`;

    const password = container.querySelector<HTMLInputElement>("#password");
    const reveal = container.querySelector<HTMLButtonElement>("#reveal-password");
    reveal?.addEventListener("click", () => {
      if (!password) return;
      const hidden = password.type === "password";
      password.type = hidden ? "text" : "password";
      reveal.textContent = hidden ? "Hide" : "Show";
      password.focus();
    });

    for (const button of container.querySelectorAll<HTMLButtonElement>("[data-mode]")) {
      button.addEventListener("click", () => {
        mode = button.dataset.mode as Mode;
        draw();
        container.querySelector<HTMLElement>("h2")?.focus();
      });
    }

    const form = container.querySelector<HTMLFormElement>("#auth-form");
    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      void submit(form);
    });
  }

  async function submit(form: HTMLFormElement): Promise<void> {
    const data = new FormData(form);
    const read = (key: string): string => String(data.get(key) ?? "");
    const submitButton = form.querySelector<HTMLButtonElement>("button[type=submit]");
    const original = submitButton?.textContent ?? "";

    if (mode === "reset") {
      const errors = validateCredentials(read("email"), "12345678");
      delete errors.password;
      if (hasProfileErrors(errors)) return showErrors(form, errors);
      try {
        setBusy(submitButton, "Sending…");
        await sendPasswordReset(read("email"));
        showToast("Reset link sent. Check your inbox.");
      } catch (error) {
        showToast(message(error));
      } finally {
        setBusy(submitButton, original, false);
      }
      return;
    }

    if (mode === "signin") {
      const errors = validateCredentials(read("email"), read("password"));
      if (hasProfileErrors(errors)) return showErrors(form, errors);
      try {
        setBusy(submitButton, "Signing in…");
        await signIn(read("email"), read("password"));
        // onAuthStateChange in main.ts takes it from here
      } catch (error) {
        showToast(message(error));
        setBusy(submitButton, original, false);
      }
      return;
    }

    const profileFields = {
      name: read("name"),
      club: read("club"),
      ageGroup: read("ageGroup"),
    };
    const errors: ProfileErrors = {
      ...validateProfile(profileFields),
      ...validateCredentials(read("email"), read("password")),
    };
    if (hasProfileErrors(errors)) return showErrors(form, errors);
    if (!isAgeGroup(profileFields.ageGroup)) return;

    try {
      setBusy(submitButton, "Creating…");
      const { needsConfirmation } = await signUp({
        name: profileFields.name,
        club: profileFields.club,
        ageGroup: profileFields.ageGroup,
        email: read("email"),
        password: read("password"),
      });
      track("register");
      // No need to seed the profile cache here. OnAuthChange caches it against
      // the user id the moment they are actually signed in
      if (needsConfirmation) {
        container.innerHTML = `
          <section class="hub-auth">
            <h2>Check your email</h2>
            <p class="hub-lede">
              Confirmation link sent to ${esc(read("email"))}. Open it on this
              device and you will land back here signed in.
            </p>
          </section>`;
      }
    } catch (error) {
      showToast(message(error));
      setBusy(submitButton, original, false);
    }
  }

  draw();
}

function setBusy(button: HTMLButtonElement | null, label: string, busy = true): void {
  if (!button) return;
  button.disabled = busy;
  button.textContent = label;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "That didn't work. Give it another go.";
}
