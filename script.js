/* ==========================================================
   Derick & Christina — Wedding Invitation
   Opening interaction · countdown · scroll reveals · RSVP
   ========================================================== */
(() => {
  'use strict';

  /* ---------- Configuration ---------- */
  const CONFIG = {
    // Wedding start: 9 January 2027, 2:30 PM IST
    weddingDate: '2027-01-09T14:30:00+05:30',

    // RSVP backend. Paste the URL that should receive RSVP submissions.
    // The form POSTs JSON: { name, attending, guests, note, submittedAt }
    // The endpoint must allow cross-origin requests (CORS) and answer with a 2xx status.
    // While this is empty, the form validates but reports that RSVPs can't be sent yet.
    rsvpEndpoint: 'https://script.google.com/macros/s/AKfycbzckAZzovUmCoy7Zy9jiJIo7I_o-nGvoELvffhtH2oCi0w9C73WGZUnFOXbc3a7cLQv/exec',
    rsvpTimeoutMs: 15000,
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- Opening → main invitation ---------- */
  function initOpening() {
    const root = document.documentElement;
    const opening = $('#opening');
    const seal = $('#seal');
    const main = $('#invitation');
    if (!opening || !seal || !main) return;

    // Keep the invitation out of reach (tab order, screen readers) until opened.
    main.inert = true;
    let opened = false;

    seal.addEventListener('click', () => {
      if (opened) return;
      opened = true;

      const instant = reducedMotion.matches;
      seal.classList.add('is-pressed');

      window.setTimeout(() => {
        root.classList.add('is-open');
        root.classList.remove('is-locked');
        main.inert = false;

        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        main.focus({ preventScroll: true });

        window.setTimeout(initReveal, instant ? 0 : 500);
        window.setTimeout(() => { opening.hidden = true; }, instant ? 0 : 1500);
      }, instant ? 0 : 220);
    });
  }

  /* ---------- Scroll reveals ---------- */
  function initReveal() {
    const items = $$('.reveal');

    if (!('IntersectionObserver' in window) || reducedMotion.matches) {
      items.forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });

    items.forEach((el) => observer.observe(el));
  }

  /* ---------- Countdown ---------- */
  function initCountdown() {
    const target = new Date(CONFIG.weddingDate).getTime();
    const grid = $('#countdown');
    const done = $('#countdown-done');
    if (!grid || !done || Number.isNaN(target)) return;

    const units = {
      days: $('[data-unit="days"]', grid),
      hours: $('[data-unit="hours"]', grid),
      minutes: $('[data-unit="minutes"]', grid),
      seconds: $('[data-unit="seconds"]', grid),
    };
    const pad = (n) => String(n).padStart(2, '0');
    let timer = null;

    function tick() {
      const diff = target - Date.now();

      if (diff <= 0) {
        grid.hidden = true;
        done.hidden = false;
        if (timer) window.clearInterval(timer);
        return;
      }

      const totalSeconds = Math.floor(diff / 1000);
      units.days.textContent = pad(Math.floor(totalSeconds / 86400));
      units.hours.textContent = pad(Math.floor((totalSeconds % 86400) / 3600));
      units.minutes.textContent = pad(Math.floor((totalSeconds % 3600) / 60));
      units.seconds.textContent = pad(totalSeconds % 60);
    }

    tick();
    timer = window.setInterval(tick, 1000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) tick();
    });
  }

  /* ---------- RSVP ---------- */
  function initRsvp() {
    const form = $('#rsvp-form');
    if (!form) return;

    const nameInput = $('#rsvp-name');
    const guestsField = $('#rsvp-guests-field');
    const guestsSelect = $('#rsvp-guests');
    const noteInput = $('#rsvp-note');
    const honeypot = $('#rsvp-website');
    const choices = $$('.choice', form);
    const submitBtn = $('#rsvp-submit');
    const statusEl = $('#rsvp-status');
    const thanks = $('#rsvp-thanks');
    const thanksSub = $('#rsvp-thanks-sub');
    const errors = {
      name: $('#rsvp-name-error'),
      attend: $('#rsvp-attend-error'),
      guests: $('#rsvp-guests-error'),
    };

    let attending = null; // 'accept' | 'decline' | null
    let submitting = false;

    /* Attendance toggle */
    choices.forEach((btn) => {
      btn.addEventListener('click', () => {
        attending = btn.dataset.value;
        choices.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
        guestsField.hidden = attending !== 'accept';
        setError('attend', '');
        setStatus('');
      });
    });

    nameInput.addEventListener('input', () => setError('name', ''));

    function setError(key, message) {
      const el = errors[key];
      if (!el) return;
      el.textContent = message;
      el.hidden = !message;
      if (key === 'name') nameInput.setAttribute('aria-invalid', message ? 'true' : 'false');
      if (key === 'guests') guestsSelect.setAttribute('aria-invalid', message ? 'true' : 'false');
    }

    function setStatus(message) {
      statusEl.textContent = message;
      statusEl.hidden = !message;
    }

    function validate() {
      let firstInvalid = null;
      const name = nameInput.value.trim();

      if (name.length < 2 || !/\p{L}/u.test(name)) {
        setError('name', 'Please enter your full name.');
        firstInvalid = firstInvalid || nameInput;
      } else if (name.length > 80) {
        setError('name', 'Please keep your name under 80 characters.');
        firstInvalid = firstInvalid || nameInput;
      }

      if (!attending) {
        setError('attend', 'Please let us know if you can join us.');
        firstInvalid = firstInvalid || choices[0];
      }

      if (attending === 'accept') {
        const guests = Number(guestsSelect.value);
        if (!Number.isInteger(guests) || guests < 1 || guests > 10) {
          setError('guests', 'Please choose between 1 and 10 guests.');
          firstInvalid = firstInvalid || guestsSelect;
        }
      }

      if (firstInvalid) firstInvalid.focus();
      return !firstInvalid;
    }

    function showThanks() {
      thanksSub.textContent = attending === 'accept'
        ? 'We look forward to celebrating with you.'
        : 'You will be in our thoughts and prayers on the day.';
      form.hidden = true;
      thanks.hidden = false;
      thanks.focus({ preventScroll: true });
      thanks.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'center' });
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (submitting) return;

      // Bots fill hidden fields; people never see this one. Ignore quietly.
      if (honeypot.value) return;

      ['name', 'attend', 'guests'].forEach((key) => setError(key, ''));
      setStatus('');

      if (!validate()) return;

      // Never claim success when nothing is connected to receive the RSVP.
      if (!CONFIG.rsvpEndpoint) {
        setStatus('RSVPs cannot be sent from this page yet. Please confirm your presence with the family directly.');
        return;
      }

      const payload = {
        name: nameInput.value.trim(),
        attending,
        guests: attending === 'accept' ? Number(guestsSelect.value) : 0,
        note: noteInput.value.trim(),
        submittedAt: new Date().toISOString(),
      };

      submitting = true;
      submitBtn.disabled = true;
      const originalLabel = submitBtn.textContent;
      submitBtn.textContent = 'Sending…';

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), CONFIG.rsvpTimeoutMs);

      try {
        const response = await fetch(CONFIG.rsvpEndpoint, {
          method: 'POST',
          // text/plain avoids a CORS preflight, which Google Apps Script cannot answer.
          // The body is still JSON; the server parses it.
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        showThanks();
      } catch (error) {
        setStatus('We could not send your RSVP. Please check your connection and try again.');
      } finally {
        window.clearTimeout(timeout);
        submitting = false;
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
      }
    });
  }

  /* ---------- Init ---------- */
  initOpening();
  initCountdown();
  initRsvp();
})();
