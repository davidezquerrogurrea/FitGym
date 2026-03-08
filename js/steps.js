(() => {
  const monthLabel = document.getElementById("monthLabel");
  const prevMonthBtn = document.getElementById("prevMonth");
  const nextMonthBtn = document.getElementById("nextMonth");
  const stepsMonthTitle = document.getElementById("stepsMonthTitle");
  const stepsTotalValue = document.getElementById("stepsTotalValue");
  const stepsAverageValue = document.getElementById("stepsAverageValue");
  const stepsBestValue = document.getElementById("stepsBestValue");
  const stepsBars = document.getElementById("stepsBars");
  const stepsAxisMid = document.getElementById("stepsAxisMid");
  const stepsAxisEnd = document.getElementById("stepsAxisEnd");
  const stepsState = document.getElementById("stepsState");
  const stepsEntryDateTitle = document.getElementById("stepsEntryDateTitle");
  const stepsForm = document.getElementById("stepsForm");
  const stepsEntryInput = document.getElementById("stepsEntryInput");
  const stepsClearBtn = document.getElementById("stepsClearBtn");
  const stepsSaveBtn = document.getElementById("stepsSaveBtn");

  if (
    !monthLabel || !prevMonthBtn || !nextMonthBtn || !stepsMonthTitle ||
    !stepsTotalValue || !stepsAverageValue || !stepsBestValue ||
    !stepsBars || !stepsAxisMid || !stepsAxisEnd || !stepsState ||
    !stepsEntryDateTitle || !stepsForm || !stepsEntryInput || !stepsClearBtn || !stepsSaveBtn
  ) {
    return;
  }

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  const fullDateFormatter = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  const numberFormatter = new Intl.NumberFormat("es-ES");
  const localStorageKey = "fitgym_routines_v1";
  const viewDate = new Date();
  viewDate.setDate(1);

  const localAdapter = createLocalAdapter();
  let persistence = createPersistenceAdapter(localAdapter);
  let stepsByDate = {};
  let selectedDateKey = "";
  let isSaving = false;

  init();

  async function init() {
    await bootstrapSteps();
    selectedDateKey = toDateKey(new Date());
    renderStepsPanel();
    loadSelectedDayForm();
  }

  async function bootstrapSteps() {
    setState("Cargando pasos...");

    const loaded = await persistence.loadAll();
    if (!loaded.ok) {
      if (persistence.kind === "supabase") {
        persistence = localAdapter;
        const fallback = await localAdapter.loadAll();
        if (fallback.ok) {
          stepsByDate = fallback.data;
          setState("Supabase no disponible. Mostrando datos locales.");
          return;
        }
      }
      setState("No se pudieron cargar los pasos.");
      return;
    }

    if (persistence.kind === "supabase") {
      const localLoaded = await localAdapter.loadAll();
      if (localLoaded.ok) {
        stepsByDate = mergeStepMaps(loaded.data, localLoaded.data);
      } else {
        stepsByDate = loaded.data;
      }
    } else {
      stepsByDate = loaded.data;
    }

    setState(
      persistence.kind === "supabase"
        ? "Pasos cargados desde Supabase."
        : "Pasos cargados en modo local."
    );
  }

  function setState(message) {
    stepsState.textContent = message || "";
  }

  function getErrorMessage(result, fallbackMessage) {
    if (result && result.error && typeof result.error.message === "string" && result.error.message) {
      return `${fallbackMessage} (${result.error.message})`;
    }
    return fallbackMessage;
  }

  function setSavingState(busy) {
    isSaving = busy;
    stepsEntryInput.disabled = busy;
    stepsClearBtn.disabled = busy;
    stepsSaveBtn.disabled = busy;
  }

  function toDateKey(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  }

  function toDateFromKey(dateKey) {
    const [year, month, day] = dateKey.split("-").map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
  }

  function isDateInMonth(dateKey, year, month) {
    if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      return false;
    }
    const date = toDateFromKey(dateKey);
    return date.getFullYear() === year && date.getMonth() === month;
  }

  function normalizeDateKey(rawDate) {
    if (typeof rawDate !== "string" || !rawDate.trim()) {
      return "";
    }

    const trimmed = rawDate.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      return "";
    }

    return toDateKey(parsed);
  }

  function mergeStepMaps(primaryMap, secondaryMap) {
    const merged = {};
    Object.assign(merged, secondaryMap || {});
    Object.assign(merged, primaryMap || {});
    return merged;
  }

  function capitalizeFirst(text) {
    if (!text) {
      return "";
    }
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function formatFullDate(dateKey) {
    return capitalizeFirst(fullDateFormatter.format(toDateFromKey(dateKey)));
  }

  function formatNumber(value) {
    return numberFormatter.format(value);
  }

  function sanitizeDailySteps(rawSteps) {
    if (rawSteps === "" || rawSteps == null) {
      return null;
    }

    const steps = Number(rawSteps);
    if (!Number.isInteger(steps) || steps < 0) {
      return null;
    }
    return steps;
  }

  function parseLocalMap(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return {};
    }

    const cleaned = {};
    Object.keys(raw).forEach((rawDateKey) => {
      const dateKey = normalizeDateKey(rawDateKey);
      if (!dateKey) {
        return;
      }

      const entry = raw[rawDateKey];
      if (!entry || typeof entry !== "object") {
        return;
      }

      const dailySteps = sanitizeDailySteps(
        entry.dailySteps != null
          ? entry.dailySteps
          : entry.daily_steps != null
            ? entry.daily_steps
            : entry.steps
      );

      if (dailySteps != null) {
        cleaned[dateKey] = { dailySteps };
      }
    });

    return cleaned;
  }

  function createLocalAdapter() {
    function readRawMap() {
      const raw = localStorage.getItem(localStorageKey);
      if (!raw) {
        return {};
      }

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return {};
      }
      return parsed;
    }

    return {
      kind: "local",
      async loadAll() {
        try {
          return { ok: true, data: parseLocalMap(readRawMap()) };
        } catch (error) {
          return { ok: false, error };
        }
      },
      async saveSteps(dateKey, dailySteps) {
        try {
          const map = readRawMap();
          const currentEntry = map[dateKey];
          const nextEntry = currentEntry && typeof currentEntry === "object" && !Array.isArray(currentEntry)
            ? { ...currentEntry }
            : {};

          if (dailySteps == null) {
            delete nextEntry.dailySteps;
            delete nextEntry.daily_steps;
            delete nextEntry.steps;
          } else {
            nextEntry.dailySteps = dailySteps;
          }

          if (Object.keys(nextEntry).length === 0) {
            delete map[dateKey];
          } else {
            map[dateKey] = nextEntry;
          }

          localStorage.setItem(localStorageKey, JSON.stringify(map));
          return { ok: true };
        } catch (error) {
          return { ok: false, error };
        }
      }
    };
  }

  function createPersistenceAdapter(fallbackLocalAdapter) {
    const cfg = window.FITGYM_SUPABASE || {};
    const hasSupabase = window.supabase && typeof window.supabase.createClient === "function";
    const hasConfig = typeof cfg.url === "string" && cfg.url && typeof cfg.anonKey === "string" && cfg.anonKey;

    if (!hasSupabase || !hasConfig) {
      return fallbackLocalAdapter;
    }

    const client = window.supabase.createClient(cfg.url, cfg.anonKey);
    return createSupabaseAdapter(client);
  }

  function createSupabaseAdapter(client) {
    return {
      kind: "supabase",
      async loadAll() {
        const daysRes = await client
          .from("workout_days")
          .select("session_date, daily_steps")
          .order("session_date", { ascending: true });

        if (daysRes.error) {
          return { ok: false, error: daysRes.error };
        }

        const map = {};
        const rows = Array.isArray(daysRes.data) ? daysRes.data : [];
        rows.forEach((row) => {
          const dateKey = normalizeDateKey(row.session_date);
          if (!dateKey) {
            return;
          }

          const dailySteps = sanitizeDailySteps(row.daily_steps);
          if (dailySteps != null) {
            map[dateKey] = { dailySteps };
          }
        });

        return { ok: true, data: map };
      },
      async saveSteps(dateKey, dailySteps) {
        const lookupDayRes = await client
          .from("workout_days")
          .select("id")
          .eq("session_date", dateKey)
          .order("created_at", { ascending: true })
          .limit(1);

        if (lookupDayRes.error) {
          return { ok: false, error: lookupDayRes.error };
        }

        const dayId = Array.isArray(lookupDayRes.data) && lookupDayRes.data.length > 0
          ? lookupDayRes.data[0].id
          : null;

        if (!dayId) {
          if (dailySteps == null) {
            return { ok: true };
          }

          const insertDayRes = await client
            .from("workout_days")
            .insert({
              session_date: dateKey,
              daily_steps: dailySteps,
              updated_at: new Date().toISOString()
            });

          if (insertDayRes.error) {
            return { ok: false, error: insertDayRes.error };
          }

          return { ok: true };
        }

        const updateDayRes = await client
          .from("workout_days")
          .update({
            daily_steps: dailySteps,
            updated_at: new Date().toISOString()
          })
          .eq("id", dayId);

        if (updateDayRes.error) {
          return { ok: false, error: updateDayRes.error };
        }

        return { ok: true };
      }
    };
  }

  function getMonthStepsSnapshot() {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daily = [];
    let total = 0;
    let max = 0;
    let bestDay = null;
    let trackedDays = 0;

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day, 12, 0, 0);
      const dateKey = toDateKey(date);
      const entry = stepsByDate[dateKey];
      const validSteps = entry ? sanitizeDailySteps(entry.dailySteps) : null;
      const steps = validSteps != null ? validSteps : 0;

      daily.push({ day, dateKey, steps });
      total += steps;

      if (steps > 0) {
        trackedDays += 1;
      }
      if (steps > max) {
        max = steps;
        bestDay = day;
      }
    }

    const average = trackedDays > 0 ? Math.round(total / trackedDays) : 0;
    return {
      year,
      month,
      daysInMonth,
      daily,
      total,
      average,
      max,
      bestDay,
      trackedDays
    };
  }

  function getBarLevel(steps, monthMax) {
    if (!Number.isFinite(steps) || steps <= 0) {
      return 0;
    }

    const baseRatio = steps / monthMax;
    const boostedRatio = Math.pow(baseRatio, 0.45);
    const minimumVisibleRatio = 0.24;
    return Math.min(1, Math.max(minimumVisibleRatio, boostedRatio));
  }

  function ensureSelectedDateInViewMonth(snapshot) {
    if (isDateInMonth(selectedDateKey, snapshot.year, snapshot.month)) {
      return;
    }

    const today = new Date();
    const isCurrentMonth = snapshot.year === today.getFullYear() && snapshot.month === today.getMonth();
    const day = isCurrentMonth
      ? Math.min(today.getDate(), snapshot.daysInMonth)
      : 1;

    selectedDateKey = toDateKey(new Date(snapshot.year, snapshot.month, day, 12, 0, 0));
  }

  function renderStepsPanel() {
    const snapshot = getMonthStepsSnapshot();
    ensureSelectedDateInViewMonth(snapshot);

    monthLabel.textContent = `${monthNames[snapshot.month]} ${snapshot.year}`;
    stepsMonthTitle.textContent = `${monthNames[snapshot.month]} ${snapshot.year}`;
    stepsTotalValue.textContent = formatNumber(snapshot.total);
    stepsAverageValue.textContent = formatNumber(snapshot.average);
    stepsBestValue.textContent = snapshot.max > 0
      ? `${formatNumber(snapshot.max)} (dia ${snapshot.bestDay})`
      : "-";

    stepsBars.style.setProperty("--days", String(snapshot.daysInMonth));
    stepsBars.innerHTML = "";
    stepsAxisMid.textContent = String(Math.ceil(snapshot.daysInMonth / 2));
    stepsAxisEnd.textContent = String(snapshot.daysInMonth);

    const monthMax = snapshot.max > 0 ? snapshot.max : 1;
    snapshot.daily.forEach((item) => {
      const bar = document.createElement("button");
      bar.type = "button";
      bar.className = "steps-bar";
      bar.dataset.date = item.dateKey;
      bar.style.setProperty("--level", String(getBarLevel(item.steps, monthMax)));
      bar.setAttribute("aria-label", `${formatFullDate(item.dateKey)}: ${formatNumber(item.steps)} pasos`);
      bar.title = `Dia ${item.day}: ${formatNumber(item.steps)} pasos`;

      if (item.steps > 0) {
        bar.classList.add("has-data");
      }
      if (item.dateKey === selectedDateKey) {
        bar.classList.add("is-selected");
      }

      stepsBars.appendChild(bar);
    });

    if (snapshot.trackedDays === 0) {
      setState("Aun no hay pasos registrados en este mes.");
      return;
    }

    setState("");
  }

  function loadSelectedDayForm() {
    if (!selectedDateKey) {
      return;
    }

    const entry = stepsByDate[selectedDateKey];
    const steps = entry ? sanitizeDailySteps(entry.dailySteps) : null;

    stepsEntryDateTitle.textContent = formatFullDate(selectedDateKey);
    stepsEntryInput.value = steps != null ? String(steps) : "";
  }

  function moveMonth(monthOffset) {
    const selectedDay = selectedDateKey
      ? toDateFromKey(selectedDateKey).getDate()
      : 1;

    viewDate.setMonth(viewDate.getMonth() + monthOffset);

    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    const nextDay = Math.min(selectedDay, daysInMonth);
    selectedDateKey = toDateKey(new Date(viewDate.getFullYear(), viewDate.getMonth(), nextDay, 12, 0, 0));

    renderStepsPanel();
    loadSelectedDayForm();
  }

  prevMonthBtn.addEventListener("click", () => {
    moveMonth(-1);
  });

  nextMonthBtn.addEventListener("click", () => {
    moveMonth(1);
  });

  stepsBars.addEventListener("click", (event) => {
    const dayBar = event.target.closest(".steps-bar");
    if (!dayBar || !dayBar.dataset.date) {
      return;
    }

    selectedDateKey = dayBar.dataset.date;
    renderStepsPanel();
    loadSelectedDayForm();
  });

  stepsClearBtn.addEventListener("click", () => {
    if (isSaving) {
      return;
    }
    stepsEntryInput.value = "";
    stepsEntryInput.focus();
  });

  stepsForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!selectedDateKey || isSaving) {
      return;
    }

    const rawValue = stepsEntryInput.value.trim();
    const dailySteps = rawValue ? sanitizeDailySteps(rawValue) : null;

    if (rawValue && dailySteps == null) {
      setState("Pasos diarios: escribe un numero entero valido.");
      return;
    }

    setSavingState(true);

    try {
      const saveResult = await persistence.saveSteps(selectedDateKey, dailySteps);
      if (!saveResult.ok) {
        setState(getErrorMessage(
          saveResult,
          persistence.kind === "supabase"
            ? "No se pudieron guardar los pasos en Supabase."
            : "No se pudieron guardar los pasos en local."
        ));
        return;
      }

      if (dailySteps == null) {
        delete stepsByDate[selectedDateKey];
      } else {
        stepsByDate[selectedDateKey] = { dailySteps };
      }

      renderStepsPanel();
      loadSelectedDayForm();
      setState(
        dailySteps == null
          ? "Registro de pasos eliminado para este dia."
          : persistence.kind === "supabase"
            ? "Pasos guardados en Supabase."
            : "Pasos guardados en local."
      );
    } finally {
      setSavingState(false);
    }
  });
})();
