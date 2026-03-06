(() => {
  const monthLabel = document.getElementById("monthLabel");
  const weekdayLabels = document.getElementById("weekdayLabels");
  const calendarGrid = document.getElementById("calendarGrid");
  const prevMonthBtn = document.getElementById("prevMonth");
  const nextMonthBtn = document.getElementById("nextMonth");
  const routinePanel = document.getElementById("routinePanel");
  const routineDateTitle = document.getElementById("routineDateTitle");
  const routineState = document.getElementById("routineState");
  const routineForm = document.getElementById("routineForm");
  const dailyStepsInput = document.getElementById("dailyStepsInput");
  const addExerciseBtn = document.getElementById("addExerciseBtn");
  const classificationList = document.getElementById("classificationList");
  const exercisesList = document.getElementById("exercisesList");
  const saveRoutineBtn = routineForm ? routineForm.querySelector("button[type='submit']") : null;
  const classificationInputs = classificationList
    ? Array.from(classificationList.querySelectorAll(".classification-input"))
    : [];

  if (
    !monthLabel || !weekdayLabels || !calendarGrid || !prevMonthBtn || !nextMonthBtn ||
    !routinePanel || !routineDateTitle || !routineState || !routineForm || !addExerciseBtn ||
    !dailyStepsInput || !classificationList || !exercisesList || !saveRoutineBtn
  ) {
    return;
  }

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  const weekdayNames = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
  const localStorageKey = "fitgym_routines_v1";
  const routineClassifications = [
    { key: "pecho", label: "Pecho", color: "#ef5a5a" },
    { key: "espalda", label: "Espalda", color: "#4f86f7" },
    { key: "triceps", label: "Triceps", color: "#f38c4a" },
    { key: "biceps", label: "Biceps", color: "#f0c94a" },
    { key: "pierna", label: "Pierna", color: "#4ad18a" },
    { key: "hombro", label: "Hombro", color: "#b787ff" }
  ];
  const validRoutineClassifications = new Set(
    routineClassifications.map((classification) => classification.key)
  );
  const classificationLabelByKey = {};
  const classificationColorByKey = {};
  routineClassifications.forEach((classification) => {
    classificationLabelByKey[classification.key] = classification.label;
    classificationColorByKey[classification.key] = classification.color;
  });
  const fullDateFormatter = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  const savedAtFormatter = new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  const viewDate = new Date();
  viewDate.setDate(1);

  const routinesByDate = {};
  const localAdapter = createLocalAdapter();
  let persistence = createPersistenceAdapter(localAdapter);
  let selectedDateKey = "";
  let isSaving = false;

  init();

  async function init() {
    renderWeekdays();
    await bootstrapRoutines();
    selectedDateKey = getInitialDateFromQuery() || toDateKey(new Date());
    const selectedDate = toDateFromKey(selectedDateKey);
    viewDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    selectRoutineDay(selectedDateKey);
  }

  async function bootstrapRoutines() {
    setState("Cargando rutinas...");

    const loaded = await persistence.loadAll();
    if (!loaded.ok) {
      if (persistence.kind === "supabase") {
        persistence = localAdapter;
        const fallback = await localAdapter.loadAll();
        if (fallback.ok) {
          replaceRoutines(fallback.data);
          setState("Supabase no disponible. Trabajando en modo local.");
          return;
        }
      }
      setState("No se pudieron cargar las rutinas.");
      return;
    }

    replaceRoutines(loaded.data);
    if (persistence.kind === "supabase") {
      setState("Conectado a Supabase.");
    } else {
      setState("Modo local activo.");
    }
  }

  function setState(message) {
    routineState.textContent = message || "";
  }

  function getErrorMessage(result, fallbackMessage) {
    if (result && result.error && typeof result.error.message === "string" && result.error.message) {
      return `${fallbackMessage} (${result.error.message})`;
    }
    return fallbackMessage;
  }

  function setSavingState(busy) {
    isSaving = busy;
    saveRoutineBtn.disabled = busy;
    addExerciseBtn.disabled = busy;
    dailyStepsInput.disabled = busy;
    classificationInputs.forEach((input) => {
      input.disabled = busy;
    });
    saveRoutineBtn.classList.toggle("is-saving", busy);
    saveRoutineBtn.setAttribute("aria-label", busy ? "Guardando datos" : "Guardar datos");
    saveRoutineBtn.setAttribute("title", busy ? "Guardando datos" : "Guardar datos");
  }

  function replaceRoutines(nextMap) {
    Object.keys(routinesByDate).forEach((key) => {
      delete routinesByDate[key];
    });
    Object.assign(routinesByDate, nextMap);
  }

  function renderWeekdays() {
    weekdayLabels.innerHTML = "";
    weekdayNames.forEach((dayName) => {
      const dayLabel = document.createElement("span");
      dayLabel.textContent = dayName;
      weekdayLabels.appendChild(dayLabel);
    });
  }

  function buildStartDate(date) {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const mondayOffset = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - mondayOffset);
    return start;
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

  function getInitialDateFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const rawDate = params.get("date");
    if (!rawDate || !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      return "";
    }

    const date = toDateFromKey(rawDate);
    if (Number.isNaN(date.getTime()) || toDateKey(date) !== rawDate) {
      return "";
    }

    return rawDate;
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

  function formatSavedAt(isoDate) {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    return savedAtFormatter.format(date);
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

  function sanitizeSetEntry(rawSet) {
    if (!rawSet || typeof rawSet !== "object") {
      return null;
    }

    const reps = Number(rawSet.reps);
    const weightKg = Number(rawSet.weightKg);

    if (
      !Number.isFinite(reps) || reps < 1 ||
      !Number.isFinite(weightKg) || weightKg < 0
    ) {
      return null;
    }

    return {
      reps: Math.trunc(reps),
      weightKg: Number(weightKg.toFixed(2))
    };
  }

  function sanitizeExerciseEntry(rawExercise) {
    if (!rawExercise || typeof rawExercise !== "object") {
      return null;
    }

    const exerciseName = typeof rawExercise.exerciseName === "string"
      ? rawExercise.exerciseName.trim()
      : typeof rawExercise.name === "string"
        ? rawExercise.name.trim()
        : "";

    if (!exerciseName) {
      return null;
    }

    const sets = [];
    if (Array.isArray(rawExercise.sets)) {
      rawExercise.sets.forEach((rawSet) => {
        const cleanedSet = sanitizeSetEntry(rawSet);
        if (cleanedSet) {
          sets.push(cleanedSet);
        }
      });
    } else {
      const legacySingleSet = sanitizeSetEntry(rawExercise);
      if (legacySingleSet) {
        sets.push(legacySingleSet);
      }
    }

    if (sets.length === 0) {
      return null;
    }

    return {
      exerciseName,
      sets
    };
  }

  function sanitizeClassificationValue(rawValue) {
    if (typeof rawValue !== "string") {
      return "";
    }

    const normalized = rawValue.trim().toLowerCase();
    if (!validRoutineClassifications.has(normalized)) {
      return "";
    }
    return normalized;
  }

  function sanitizeClassifications(rawClassifications) {
    const values = Array.isArray(rawClassifications)
      ? rawClassifications
      : typeof rawClassifications === "string"
        ? rawClassifications.split(/[,\s;/|]+/)
        : [];

    if (values.length === 0) {
      return [];
    }

    const seen = new Set();
    const cleaned = [];
    values.forEach((rawValue) => {
      const value = sanitizeClassificationValue(rawValue);
      if (value && !seen.has(value)) {
        seen.add(value);
        cleaned.push(value);
      }
    });
    return cleaned;
  }

  function getRoutineClassifications(entry) {
    if (!entry || typeof entry !== "object") {
      return [];
    }
    return sanitizeClassifications(entry.classifications);
  }

  function getClassificationLabel(classification) {
    return classificationLabelByKey[classification] || classification;
  }

  function getClassificationColor(classification) {
    return classificationColorByKey[classification] || "#63d0b7";
  }

  function isMissingSupabaseColumnError(error, columnName) {
    const message = error && typeof error.message === "string"
      ? error.message.toLowerCase()
      : "";
    const missingColumn =
      message.includes("does not exist") ||
      message.includes("schema cache");
    return missingColumn && message.includes(columnName.toLowerCase());
  }

  function sanitizeRoutineEntry(rawEntry) {
    if (!rawEntry || typeof rawEntry !== "object") {
      return null;
    }

    const exercises = [];
    const dailySteps = sanitizeDailySteps(
      rawEntry.dailySteps != null
        ? rawEntry.dailySteps
        : rawEntry.daily_steps != null
          ? rawEntry.daily_steps
          : rawEntry.steps
    );
    const classifications = sanitizeClassifications(
      rawEntry.classifications != null
        ? rawEntry.classifications
        : rawEntry.classification != null
          ? rawEntry.classification
          : rawEntry.types
    );

    if (Array.isArray(rawEntry.exercises)) {
      rawEntry.exercises.forEach((rawExercise) => {
        const cleanedExercise = sanitizeExerciseEntry(rawExercise);
        if (cleanedExercise) {
          exercises.push(cleanedExercise);
        }
      });
    } else {
      const legacyExercise = sanitizeExerciseEntry(rawEntry);
      if (legacyExercise) {
        exercises.push(legacyExercise);
      }
    }

    if (exercises.length === 0 && dailySteps == null && classifications.length === 0) {
      return null;
    }

    return {
      exercises,
      dailySteps,
      classifications,
      updatedAt: typeof rawEntry.updatedAt === "string"
        ? rawEntry.updatedAt
        : typeof rawEntry.updated_at === "string"
          ? rawEntry.updated_at
          : null
    };
  }

  function hasDayContent(entry) {
    if (!entry || typeof entry !== "object") {
      return false;
    }

    const hasExercises = Array.isArray(entry.exercises) && entry.exercises.length > 0;
    const hasSteps = Number.isInteger(entry.dailySteps) && entry.dailySteps >= 0;
    const hasClassifications = getRoutineClassifications(entry).length > 0;
    return hasExercises || hasSteps || hasClassifications;
  }

  function getFirstRoutineDateKey() {
    const routineDates = Object.keys(routinesByDate)
      .filter((dateKey) => hasDayContent(routinesByDate[dateKey]))
      .sort();
    return routineDates.length > 0 ? routineDates[0] : "";
  }

  function parseLocalMap(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return {};
    }

    const cleaned = {};
    Object.keys(raw).forEach((dateKey) => {
      const routine = sanitizeRoutineEntry(raw[dateKey]);
      if (routine) {
        cleaned[dateKey] = routine;
      }
    });
    return cleaned;
  }

  function createLocalAdapter() {
    return {
      kind: "local",
      async loadAll() {
        try {
          const raw = localStorage.getItem(localStorageKey);
          if (!raw) {
            return { ok: true, data: {} };
          }
          const parsed = JSON.parse(raw);
          return { ok: true, data: parseLocalMap(parsed) };
        } catch (error) {
          return { ok: false, error };
        }
      },
      async saveDay(dateKey, routine) {
        try {
          const currentRaw = localStorage.getItem(localStorageKey);
          const currentMap = parseLocalMap(currentRaw ? JSON.parse(currentRaw) : {});
          currentMap[dateKey] = routine;
          localStorage.setItem(localStorageKey, JSON.stringify(currentMap));
          return { ok: true };
        } catch (error) {
          return { ok: false, error };
        }
      },
      async deleteDay(dateKey) {
        try {
          const currentRaw = localStorage.getItem(localStorageKey);
          const currentMap = parseLocalMap(currentRaw ? JSON.parse(currentRaw) : {});
          delete currentMap[dateKey];
          localStorage.setItem(localStorageKey, JSON.stringify(currentMap));
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
    let supportsClassificationsColumn = true;

    function buildDayPayload(routine) {
      const payload = {
        daily_steps: routine.dailySteps,
        updated_at: routine.updatedAt || new Date().toISOString()
      };
      if (supportsClassificationsColumn) {
        payload.classifications = sanitizeClassifications(routine.classifications);
      }
      return payload;
    }

    return {
      kind: "supabase",

      async loadAll() {
        let daysRes = await client
          .from("workout_days")
          .select("id, session_date, updated_at, daily_steps, classifications")
          .order("session_date", { ascending: true });

        if (daysRes.error && isMissingSupabaseColumnError(daysRes.error, "classifications")) {
          supportsClassificationsColumn = false;
          daysRes = await client
            .from("workout_days")
            .select("id, session_date, updated_at, daily_steps")
            .order("session_date", { ascending: true });
        }

        if (daysRes.error) {
          return { ok: false, error: daysRes.error };
        }

        const days = Array.isArray(daysRes.data) ? daysRes.data : [];
        if (days.length === 0) {
          return { ok: true, data: {} };
        }

        const dayIds = days.map((d) => d.id);
        const exercisesRes = await client
          .from("workout_exercises")
          .select("id, day_id, exercise_name, exercise_order")
          .in("day_id", dayIds)
          .order("exercise_order", { ascending: true });

        if (exercisesRes.error) {
          return { ok: false, error: exercisesRes.error };
        }

        const exercises = Array.isArray(exercisesRes.data) ? exercisesRes.data : [];
        const exerciseIds = exercises.map((e) => e.id);

        let sets = [];
        if (exerciseIds.length > 0) {
          const setsRes = await client
            .from("workout_sets")
            .select("exercise_id, set_number, reps, weight_kg")
            .in("exercise_id", exerciseIds)
            .order("set_number", { ascending: true });

          if (setsRes.error) {
            return { ok: false, error: setsRes.error };
          }
          sets = Array.isArray(setsRes.data) ? setsRes.data : [];
        }

        const setsByExerciseId = new Map();
        sets.forEach((setRow) => {
          if (!setsByExerciseId.has(setRow.exercise_id)) {
            setsByExerciseId.set(setRow.exercise_id, []);
          }
          const cleanedSet = sanitizeSetEntry({
            reps: setRow.reps,
            weightKg: Number(setRow.weight_kg)
          });
          if (cleanedSet) {
            setsByExerciseId.get(setRow.exercise_id).push(cleanedSet);
          }
        });

        const exercisesByDayId = new Map();
        exercises.forEach((exerciseRow) => {
          const rawExercise = {
            exerciseName: exerciseRow.exercise_name,
            sets: setsByExerciseId.get(exerciseRow.id) || []
          };
          const cleanedExercise = sanitizeExerciseEntry(rawExercise);
          if (!cleanedExercise) {
            return;
          }
          if (!exercisesByDayId.has(exerciseRow.day_id)) {
            exercisesByDayId.set(exerciseRow.day_id, []);
          }
          exercisesByDayId.get(exerciseRow.day_id).push({
            ...cleanedExercise,
            exerciseOrder: exerciseRow.exercise_order
          });
        });

        const map = {};
        days.forEach((dayRow) => {
          const dayExercises = exercisesByDayId.get(dayRow.id) || [];
          dayExercises.sort((a, b) => a.exerciseOrder - b.exerciseOrder);
          const dailySteps = sanitizeDailySteps(dayRow.daily_steps);
          const classifications = supportsClassificationsColumn
            ? sanitizeClassifications(dayRow.classifications)
            : [];
          const cleaned = dayExercises.map((exercise) => ({
            exerciseName: exercise.exerciseName,
            sets: exercise.sets
          }));

          if (cleaned.length > 0 || dailySteps != null || classifications.length > 0) {
            map[dayRow.session_date] = {
              exercises: cleaned,
              dailySteps,
              classifications,
              updatedAt: dayRow.updated_at || null
            };
          }
        });

        return { ok: true, data: map };
      },

      async saveDay(dateKey, routine) {
        const lookupDayRes = await client
          .from("workout_days")
          .select("id, created_at")
          .eq("session_date", dateKey)
          .order("created_at", { ascending: true })
          .limit(1);

        if (lookupDayRes.error) {
          return { ok: false, error: lookupDayRes.error };
        }

        let dayId = Array.isArray(lookupDayRes.data) && lookupDayRes.data.length > 0
          ? lookupDayRes.data[0].id
          : null;

        if (!dayId) {
          let insertDayRes = await client
            .from("workout_days")
            .insert({
              session_date: dateKey,
              ...buildDayPayload(routine)
            })
            .select("id")
            .single();

          if (
            insertDayRes.error &&
            supportsClassificationsColumn &&
            isMissingSupabaseColumnError(insertDayRes.error, "classifications")
          ) {
            supportsClassificationsColumn = false;
            insertDayRes = await client
              .from("workout_days")
              .insert({
                session_date: dateKey,
                ...buildDayPayload(routine)
              })
              .select("id")
              .single();
          }

          if (insertDayRes.error || !insertDayRes.data) {
            return { ok: false, error: insertDayRes.error || new Error("No se pudo crear el dia.") };
          }

          dayId = insertDayRes.data.id;
        } else {
          let updateDayRes = await client
            .from("workout_days")
            .update(buildDayPayload(routine))
            .eq("id", dayId);

          if (
            updateDayRes.error &&
            supportsClassificationsColumn &&
            isMissingSupabaseColumnError(updateDayRes.error, "classifications")
          ) {
            supportsClassificationsColumn = false;
            updateDayRes = await client
              .from("workout_days")
              .update(buildDayPayload(routine))
              .eq("id", dayId);
          }

          if (updateDayRes.error) {
            return { ok: false, error: updateDayRes.error };
          }
        }

        const deleteExercisesRes = await client
          .from("workout_exercises")
          .delete()
          .eq("day_id", dayId);

        if (deleteExercisesRes.error) {
          return { ok: false, error: deleteExercisesRes.error };
        }

        if (!Array.isArray(routine.exercises) || routine.exercises.length === 0) {
          return { ok: true };
        }

        const exercisePayload = routine.exercises.map((exercise, index) => ({
          day_id: dayId,
          exercise_name: exercise.exerciseName,
          exercise_order: index + 1
        }));

        const insertExercisesRes = await client
          .from("workout_exercises")
          .insert(exercisePayload)
          .select("id, exercise_order");

        if (insertExercisesRes.error) {
          return { ok: false, error: insertExercisesRes.error };
        }

        const insertedExercises = Array.isArray(insertExercisesRes.data) ? insertExercisesRes.data : [];
        const exerciseIdByOrder = new Map();
        insertedExercises.forEach((exerciseRow) => {
          exerciseIdByOrder.set(exerciseRow.exercise_order, exerciseRow.id);
        });

        const setsPayload = [];
        routine.exercises.forEach((exercise, exerciseIndex) => {
          const exerciseId = exerciseIdByOrder.get(exerciseIndex + 1);
          if (!exerciseId) {
            return;
          }
          exercise.sets.forEach((set, setIndex) => {
            setsPayload.push({
              exercise_id: exerciseId,
              set_number: setIndex + 1,
              reps: set.reps,
              weight_kg: set.weightKg
            });
          });
        });

        if (setsPayload.length > 0) {
          const insertSetsRes = await client
            .from("workout_sets")
            .insert(setsPayload);

          if (insertSetsRes.error) {
            return { ok: false, error: insertSetsRes.error };
          }
        }

        return { ok: true };
      },

      async deleteDay(dateKey) {
        const deleteDayRes = await client
          .from("workout_days")
          .delete()
          .eq("session_date", dateKey);

        if (deleteDayRes.error) {
          return { ok: false, error: deleteDayRes.error };
        }
        return { ok: true };
      }
    };
  }

  function createSetRow(setData = {}) {
    const setRow = document.createElement("div");
    setRow.className = "set-row";
    setRow.innerHTML = `
      <div class="set-label"></div>
      <label class="set-inline">
        <span>Reps</span>
        <input class="field-control set-reps" type="number" min="1" step="1" inputmode="numeric" required>
      </label>
      <label class="set-inline">
        <span>Kg</span>
        <input class="field-control set-weight" type="number" min="0" step="0.5" inputmode="decimal" required>
      </label>
      <button class="set-remove" type="button" aria-label="Eliminar serie">&times;</button>
    `;

    const repsInput = setRow.querySelector(".set-reps");
    const weightInput = setRow.querySelector(".set-weight");

    if (repsInput && setData.reps != null) {
      repsInput.value = String(setData.reps);
    }
    if (weightInput && setData.weightKg != null) {
      weightInput.value = String(setData.weightKg);
    }

    return setRow;
  }

  function renumberSetRows(exerciseCard) {
    const rows = exerciseCard.querySelectorAll(".set-row");
    rows.forEach((row, index) => {
      const label = row.querySelector(".set-label");
      if (label) {
        label.textContent = `S${index + 1}`;
      }
    });
  }

  function addSetToExercise(exerciseCard, setData = {}) {
    const setsContainer = exerciseCard.querySelector(".exercise-sets");
    if (!setsContainer) {
      return;
    }
    setsContainer.appendChild(createSetRow(setData));
    renumberSetRows(exerciseCard);
  }

  function createExerciseCard(exerciseData = {}) {
    const card = document.createElement("article");
    card.className = "exercise-card";
    card.innerHTML = `
      <div class="exercise-header">
        <label class="exercise-input-wrap">
          <input class="field-control exercise-name" type="text" maxlength="80" placeholder="Ejercicio" required>
        </label>
        <div class="exercise-actions">
          <button class="exercise-remove" type="button">Eliminar</button>
        </div>
      </div>
      <div class="exercise-sets"></div>
      <button class="secondary-btn add-set-btn" type="button">+ Agregar serie</button>
    `;

    const nameInput = card.querySelector(".exercise-name");
    if (nameInput && typeof exerciseData.exerciseName === "string") {
      nameInput.value = exerciseData.exerciseName;
    }

    exercisesList.appendChild(card);

    if (Array.isArray(exerciseData.sets) && exerciseData.sets.length > 0) {
      exerciseData.sets.forEach((setData) => addSetToExercise(card, setData));
    } else {
      addSetToExercise(card, { reps: 8 });
    }
    return card;
  }

  function clearExerciseCards() {
    exercisesList.innerHTML = "";
  }

  function loadClassificationsIntoForm(routine) {
    const selected = new Set(getRoutineClassifications(routine));
    classificationInputs.forEach((input) => {
      input.checked = selected.has(input.value);
    });
  }

  function loadRoutineIntoForm(routine) {
    loadClassificationsIntoForm(routine);
    dailyStepsInput.value = routine && Number.isInteger(routine.dailySteps)
      ? String(routine.dailySteps)
      : "";

    clearExerciseCards();

    if (routine && Array.isArray(routine.exercises) && routine.exercises.length > 0) {
      routine.exercises.forEach((exercise) => {
        createExerciseCard(exercise);
      });
    } else {
      createExerciseCard({});
    }
  }

  function collectExerciseFromCard(card, exerciseIndex) {
    const nameInput = card.querySelector(".exercise-name");
    const exerciseName = nameInput ? nameInput.value.trim() : "";

    if (!exerciseName) {
      return {
        ok: false,
        message: `Ejercicio ${exerciseIndex + 1}: escribe el nombre del ejercicio.`
      };
    }

    const setRows = Array.from(card.querySelectorAll(".set-row"));
    if (setRows.length === 0) {
      return {
        ok: false,
        message: `${exerciseName}: agrega al menos una serie.`
      };
    }

    const sets = [];

    for (let setIndex = 0; setIndex < setRows.length; setIndex += 1) {
      const row = setRows[setIndex];
      const repsInput = row.querySelector(".set-reps");
      const weightInput = row.querySelector(".set-weight");
      const reps = repsInput ? Number(repsInput.value) : NaN;
      const weightKg = weightInput ? Number(weightInput.value) : NaN;

      if (!Number.isInteger(reps) || reps < 1) {
        return {
          ok: false,
          message: `${exerciseName} - Serie ${setIndex + 1}: reps invalidas.`
        };
      }

      if (!Number.isFinite(weightKg) || weightKg < 0) {
        return {
          ok: false,
          message: `${exerciseName} - Serie ${setIndex + 1}: peso invalido.`
        };
      }

      sets.push({
        reps,
        weightKg: Number(weightKg.toFixed(2))
      });
    }

    return {
      ok: true,
      exercise: {
        exerciseName,
        sets
      }
    };
  }

  function isExerciseCardEmpty(card) {
    const nameInput = card.querySelector(".exercise-name");
    const exerciseName = nameInput ? nameInput.value.trim() : "";
    if (exerciseName) {
      return false;
    }

    const weightInputs = Array.from(card.querySelectorAll(".set-weight"));
    const hasAnyWeight = weightInputs.some((input) => input.value.trim() !== "");
    return !hasAnyWeight;
  }

  function collectDailyStepsFromForm() {
    const rawSteps = dailyStepsInput.value.trim();
    if (!rawSteps) {
      return { ok: true, dailySteps: null };
    }

    const dailySteps = sanitizeDailySteps(rawSteps);
    if (dailySteps == null) {
      return {
        ok: false,
        message: "Pasos diarios: escribe un numero entero valido."
      };
    }

    return { ok: true, dailySteps };
  }

  function collectClassificationsFromForm() {
    return sanitizeClassifications(
      classificationInputs
        .filter((input) => input.checked)
        .map((input) => input.value)
    );
  }

  function collectRoutineFromForm() {
    const stepsResult = collectDailyStepsFromForm();
    if (!stepsResult.ok) {
      return stepsResult;
    }
    const classifications = collectClassificationsFromForm();

    const cards = Array.from(exercisesList.querySelectorAll(".exercise-card"));
    if (cards.length === 0) {
      return { ok: true, exercises: [], dailySteps: stepsResult.dailySteps, classifications };
    }

    const exercises = [];

    for (let i = 0; i < cards.length; i += 1) {
      if (isExerciseCardEmpty(cards[i])) {
        continue;
      }

      const result = collectExerciseFromCard(cards[i], i);
      if (!result.ok) {
        return result;
      }
      exercises.push(result.exercise);
    }

    return { ok: true, exercises, dailySteps: stepsResult.dailySteps, classifications };
  }

  function appendRoutineMarkers(dayBtn, routine) {
    const markerWrap = document.createElement("span");
    markerWrap.className = "day-markers";
    markerWrap.setAttribute("aria-hidden", "true");

    const classifications = getRoutineClassifications(routine);
    if (classifications.length === 0) {
      const marker = document.createElement("span");
      marker.className = "day-marker is-default";
      markerWrap.appendChild(marker);
    } else {
      classifications.forEach((classification) => {
        const marker = document.createElement("span");
        marker.className = "day-marker";
        marker.style.backgroundColor = getClassificationColor(classification);
        marker.title = getClassificationLabel(classification);
        markerWrap.appendChild(marker);
      });
    }

    dayBtn.appendChild(markerWrap);
  }

  function renderCalendar() {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    monthLabel.textContent = `${monthNames[month]} ${year}`;

    calendarGrid.innerHTML = "";
    const gridStartDate = buildStartDate(viewDate);
    const todayKey = toDateKey(new Date());
    const firstRoutineDateKey = getFirstRoutineDateKey();

    for (let i = 0; i < 42; i += 1) {
      const cellDate = new Date(gridStartDate);
      cellDate.setDate(gridStartDate.getDate() + i);

      const dayBtn = document.createElement("button");
      dayBtn.type = "button";
      dayBtn.className = "day-button";
      const dayNumber = document.createElement("span");
      dayNumber.className = "day-number";
      dayNumber.textContent = String(cellDate.getDate());
      dayBtn.appendChild(dayNumber);
      const dateKey = toDateKey(cellDate);
      dayBtn.dataset.date = dateKey;

      if (cellDate.getMonth() !== month) {
        dayBtn.classList.add("is-outside");
      }

      if (dateKey === todayKey) {
        dayBtn.classList.add("is-today");
      }

      if (dateKey === selectedDateKey) {
        dayBtn.classList.add("is-selected");
      }

      const routine = routinesByDate[dateKey];
      const hasRoutine = hasDayContent(routine);
      if (hasRoutine) {
        dayBtn.classList.add("has-routine");
        appendRoutineMarkers(dayBtn, routine);
      } else if (
        firstRoutineDateKey &&
        dateKey >= firstRoutineDateKey &&
        dateKey <= todayKey
      ) {
        dayBtn.classList.add("is-missing-routine");
      }

      calendarGrid.appendChild(dayBtn);
    }

  }

  function selectRoutineDay(dateKey) {
    if (!dateKey) {
      return;
    }
    selectedDateKey = dateKey;
    routineDateTitle.textContent = formatFullDate(dateKey);

    const existingRoutine = routinesByDate[dateKey];
    if (existingRoutine) {
      setState(
        existingRoutine.updatedAt
          ? `Datos cargados (${formatSavedAt(existingRoutine.updatedAt)}).`
          : "Datos cargados."
      );
      loadRoutineIntoForm(existingRoutine);
    } else {
      setState("No hay datos en este dia. Agrega clasificacion, pasos o ejercicios.");
      loadRoutineIntoForm(null);
    }
    renderCalendar();
  }

  prevMonthBtn.addEventListener("click", () => {
    viewDate.setMonth(viewDate.getMonth() - 1);
    renderCalendar();
  });

  nextMonthBtn.addEventListener("click", () => {
    viewDate.setMonth(viewDate.getMonth() + 1);
    renderCalendar();
  });

  calendarGrid.addEventListener("click", (event) => {
    const dayButton = event.target.closest(".day-button");
    if (!dayButton) {
      return;
    }
    selectRoutineDay(dayButton.dataset.date);
  });

  addExerciseBtn.addEventListener("click", () => {
    if (isSaving) {
      return;
    }
    const card = createExerciseCard({});
    const input = card.querySelector(".exercise-name");
    if (input) {
      input.focus();
    }
  });

  exercisesList.addEventListener("click", (event) => {
    if (isSaving) {
      return;
    }

    const addSetButton = event.target.closest(".add-set-btn");
    if (addSetButton) {
      const exerciseCard = addSetButton.closest(".exercise-card");
      if (!exerciseCard) {
        return;
      }
      addSetToExercise(exerciseCard);
      const rows = exerciseCard.querySelectorAll(".set-row");
      const lastRow = rows[rows.length - 1];
      if (lastRow) {
        const repsInput = lastRow.querySelector(".set-reps");
        if (repsInput) {
          repsInput.focus();
        }
      }
      return;
    }

    const removeSetButton = event.target.closest(".set-remove");
    if (removeSetButton) {
      const exerciseCard = removeSetButton.closest(".exercise-card");
      const setRow = removeSetButton.closest(".set-row");
      if (!exerciseCard || !setRow) {
        return;
      }
      setRow.remove();
      renumberSetRows(exerciseCard);
      return;
    }

    const removeExerciseButton = event.target.closest(".exercise-remove");
    if (removeExerciseButton) {
      const exerciseCard = removeExerciseButton.closest(".exercise-card");
      if (!exerciseCard) {
        return;
      }
      exerciseCard.remove();
    }
  });

  routineForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!selectedDateKey || isSaving) {
      return;
    }

    const routineResult = collectRoutineFromForm();
    if (!routineResult.ok) {
      setState(routineResult.message);
      return;
    }

    setSavingState(true);

    try {
      if (
        routineResult.exercises.length === 0 &&
        routineResult.dailySteps == null &&
        routineResult.classifications.length === 0
      ) {
        const deleteResult = await persistence.deleteDay(selectedDateKey);
        if (!deleteResult.ok) {
          setState(getErrorMessage(
            deleteResult,
            persistence.kind === "supabase"
              ? "No se pudieron eliminar los datos del dia en Supabase."
              : "No se pudieron eliminar los datos del dia en local."
          ));
          return;
        }

        delete routinesByDate[selectedDateKey];
        renderCalendar();
        setState("Datos eliminados para este dia.");
        loadRoutineIntoForm(null);
        return;
      }

      const nextRoutine = {
        exercises: routineResult.exercises,
        dailySteps: routineResult.dailySteps,
        classifications: routineResult.classifications,
        updatedAt: new Date().toISOString()
      };

      const saveResult = await persistence.saveDay(selectedDateKey, nextRoutine);
      if (!saveResult.ok) {
        setState(getErrorMessage(
          saveResult,
          persistence.kind === "supabase"
            ? "No se pudieron guardar los datos del dia en Supabase."
            : "No se pudieron guardar los datos del dia en local."
        ));
        return;
      }

      routinesByDate[selectedDateKey] = nextRoutine;

      renderCalendar();
      setState(persistence.kind === "supabase"
        ? "Datos guardados en Supabase."
        : "Datos guardados en local.");
    } finally {
      setSavingState(false);
    }
  });

})();
