(function () {
  const MEAL_TYPES = ["breakfast", "lunch", "afternoon_snack"];
  const MEAL_LABELS = {
    breakfast: "Café da manhã",
    lunch: "Almoço",
    afternoon_snack: "Café da tarde"
  };
  const DAY_NAMES = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira"];
  const PERIOD_LABELS = {
    year: "Ano inteiro",
    semester_1: "1º semestre",
    semester_2: "2º semestre",
    custom: "Período anterior"
  };
  const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function parseDate(value) {
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? new Date() : date;
  }

  function dateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function addDays(date, amount) {
    const next = new Date(date);
    next.setDate(next.getDate() + amount);
    return next;
  }

  function firstMondayOnOrAfter(value) {
    const date = parseDate(value);
    const offset = (8 - date.getDay()) % 7;
    return addDays(date, offset);
  }

  function periodBounds(year, periodType) {
    if (periodType === "semester_1") {
      return { validFrom: `${year}-01-01`, validUntil: `${year}-06-30` };
    }
    if (periodType === "semester_2") {
      return { validFrom: `${year}-07-01`, validUntil: `${year}-12-31` };
    }
    return { validFrom: `${year}-01-01`, validUntil: `${year}-12-31` };
  }

  function createId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (character) {
      const random = Math.floor(Math.random() * 16);
      const value = character === "x" ? random : (random & 0x3) | 0x8;
      return value.toString(16);
    });
  }

  function isManager(session) {
    return ["administrador", "funcionarios"].includes(session?.role);
  }

  function mountModalPortal(modal) {
    if (modal && modal.parentElement !== document.body) document.body.appendChild(modal);
  }

  function setModalOpen(modal, open) {
    if (!modal) return;
    modal.hidden = !open;
    const anyOpen = Array.from(document.querySelectorAll(".app-modal")).some(function (item) {
      return !item.hidden;
    });
    document.body.classList.toggle("app-modal-open", anyOpen);
  }

  function ensureShellContent(callback) {
    if (document.getElementById("menu-list")) {
      callback();
      return;
    }
    window.addEventListener("agenda-shell-ready", function handleReady() {
      window.removeEventListener("agenda-shell-ready", handleReady);
      callback();
    });
  }

  function normalizeMeals(meals) {
    const values = Array.isArray(meals) ? meals : [];
    return values.map(function (meal) {
      return { type: meal.type || "", description: String(meal.description || "").trim() };
    }).filter(function (meal) {
      return Boolean(MEAL_LABELS[meal.type]) && meal.description;
    });
  }

  function targetLabel(records) {
    const targets = Array.from(new Set(records.flatMap(function (record) {
      return Array.isArray(record.targetTurmas) ? record.targetTurmas : [];
    })));
    if (!targets.length) return "Toda a escola";
    if (targets.length === 1) return targets[0];
    return `${targets.length} turmas`;
  }

  function formatPeriod(cycle) {
    if (!cycle) return "-";
    if (cycle.periodType === "custom") {
      return `${SHORT_DATE_FORMATTER.format(parseDate(cycle.validFrom))} a ${SHORT_DATE_FORMATTER.format(parseDate(cycle.validUntil))}`;
    }
    return `${PERIOD_LABELS[cycle.periodType] || "Período"} de ${cycle.periodYear}`;
  }

  function shortPeriod(cycle) {
    if (!cycle) return "-";
    if (cycle.periodType === "semester_1") return `1º sem. ${cycle.periodYear}`;
    if (cycle.periodType === "semester_2") return `2º sem. ${cycle.periodYear}`;
    if (cycle.periodType === "year") return `Ano ${cycle.periodYear}`;
    return String(cycle.periodYear || "Anterior");
  }

  function mount() {
    async function init(session) {
      if (!session || !window.AgendaGamaDataStore) return;

      const refs = {
        newButton: document.getElementById("menu-new"),
        statPeriod: document.getElementById("menu-stat-period"),
        periodFilter: document.getElementById("menu-period-filter"),
        periodLabel: document.getElementById("menu-period-label"),
        periodActions: document.getElementById("menu-period-actions"),
        editPeriod: document.getElementById("menu-edit-period"),
        publishPeriod: document.getElementById("menu-publish-period"),
        deletePeriod: document.getElementById("menu-delete-period"),
        list: document.getElementById("menu-list"),
        empty: document.getElementById("menu-empty"),
        feedback: document.getElementById("menu-feedback"),
        modal: document.getElementById("menu-editor-modal"),
        editor: document.getElementById("menu-editor"),
        editorTitle: document.getElementById("menu-editor-title"),
        editorClose: document.getElementById("menu-editor-close"),
        editorCancel: document.getElementById("menu-editor-cancel"),
        editorFeedback: document.getElementById("menu-editor-feedback"),
        periodYear: document.getElementById("menu-period-year"),
        periodType: document.getElementById("menu-period-type"),
        audience: document.getElementById("menu-audience"),
        targetBlock: document.getElementById("menu-target-block"),
        turmaList: document.getElementById("menu-turma-list"),
        turmaEmpty: document.getElementById("menu-turma-empty"),
        selectAllTurmas: document.getElementById("menu-select-all-turmas"),
        clearTurmas: document.getElementById("menu-clear-turmas"),
        dayRows: Array.from(document.querySelectorAll("[data-menu-day]")),
        allergens: document.getElementById("menu-allergens"),
        notes: document.getElementById("menu-notes")
      };

      mountModalPortal(refs.modal);
      const [menus, turmas] = await Promise.all([
        window.AgendaGamaDataStore.list("menus", []),
        window.AgendaGamaDataStore.list("turmas", [])
      ]).catch(function (error) {
        refs.feedback.textContent = `Não foi possível carregar o cardápio: ${error.message}`;
        refs.feedback.className = "feedback error";
        return [[], []];
      });

      const state = {
        menus: menus || [],
        turmas: turmas || [],
        selectedCycleId: "",
        editingCycleId: "",
        expandedWeekdays: new Set([new Date().getDay()])
      };

      function setFeedback(message, type) {
        refs.feedback.textContent = message || "";
        refs.feedback.className = `feedback${type ? ` ${type}` : ""}`;
      }

      function buildCycles() {
        const grouped = new Map();
        state.menus.forEach(function (menu) {
          const fallbackId = `legacy-${menu.validFrom || menu.menuDate || menu.id}`;
          const cycleId = menu.cycleId || fallbackId;
          if (!grouped.has(cycleId)) grouped.set(cycleId, []);
          grouped.get(cycleId).push(menu);
        });

        return Array.from(grouped.entries()).map(function ([id, records]) {
          records.sort(function (left, right) {
            return Number(left.weekday || parseDate(left.menuDate).getDay()) - Number(right.weekday || parseDate(right.menuDate).getDay());
          });
          const template = records[0];
          return {
            id: id,
            records: records,
            periodType: template.periodType || "custom",
            periodYear: Number(template.periodYear || parseDate(template.menuDate).getFullYear()),
            validFrom: template.validFrom || template.menuDate,
            validUntil: template.validUntil || template.menuDate,
            status: records.every(function (record) { return record.status === "published"; }) ? "published" : "draft",
            target: targetLabel(records)
          };
        }).sort(function (left, right) {
          return right.validFrom.localeCompare(left.validFrom) || right.id.localeCompare(left.id);
        });
      }

      function selectedCycle(cycles) {
        return cycles.find(function (cycle) { return cycle.id === state.selectedCycleId; }) || null;
      }

      function ensureSelectedCycle(cycles) {
        if (selectedCycle(cycles)) return;
        const today = dateKey(new Date());
        const active = cycles.find(function (cycle) {
          return cycle.validFrom <= today && cycle.validUntil >= today;
        });
        state.selectedCycleId = active?.id || cycles[0]?.id || "";
      }

      function mealList(menu) {
        const mealMap = new Map(normalizeMeals(menu?.meals).map(function (meal) {
          return [meal.type, meal];
        }));
        return MEAL_TYPES.map(function (type) {
          const meal = mealMap.get(type);
          return `
            <div class="menu-meal-item ${meal ? "" : "is-empty"}">
              <span class="menu-meal-icon">${escapeHtml(MEAL_LABELS[type].slice(0, 1))}</span>
              <div><strong>${escapeHtml(MEAL_LABELS[type])}</strong><p>${escapeHtml(meal?.description || "Não informado")}</p></div>
            </div>
          `;
        }).join("");
      }

      function menuCard(cycle, weekday) {
        const menu = cycle.records.find(function (record) {
          return Number(record.weekday || parseDate(record.menuDate).getDay()) === weekday;
        });
        const expanded = state.expandedWeekdays.has(weekday);
        return `
          <article class="menu-day-card ${menu ? "" : "menu-day-card-empty"}">
            <button class="menu-day-summary" type="button" data-menu-toggle-day="${weekday}" aria-expanded="${expanded}">
              <span class="menu-day-date"><strong>${escapeHtml(DAY_NAMES[weekday - 1].slice(0, 3))}</strong><small>semana</small></span>
              <span class="menu-day-copy">
                <small>Cardápio recorrente</small>
                <strong>${escapeHtml(DAY_NAMES[weekday - 1])}</strong>
                <span>${menu ? `3 refeições · ${escapeHtml(cycle.target)}` : "Cardápio não informado"}</span>
              </span>
              <span class="status-badge menu-status-${escapeHtml(menu?.status || "empty")}">${menu?.status === "published" ? "Publicado" : menu ? "Rascunho" : "Pendente"}</span>
              <span class="menu-expand-icon">${expanded ? "−" : "+"}</span>
            </button>
            <div class="menu-day-details" ${expanded ? "" : "hidden"}>
              <div class="menu-meal-list">${mealList(menu)}</div>
              ${menu?.allergens ? `<div class="menu-info-note menu-allergen-note"><strong>Alergênicos</strong><span>${escapeHtml(menu.allergens)}</span></div>` : ""}
              ${menu?.notes ? `<div class="menu-info-note"><strong>Observações</strong><span>${escapeHtml(menu.notes)}</span></div>` : ""}
            </div>
          </article>
        `;
      }

      function renderPeriodOptions(cycles) {
        if (!cycles.length) {
          refs.periodFilter.innerHTML = '<option value="">Nenhum período cadastrado</option>';
          refs.periodFilter.disabled = true;
          return;
        }
        refs.periodFilter.disabled = false;
        refs.periodFilter.innerHTML = cycles.map(function (cycle) {
          const status = cycle.status === "draft" ? " · Rascunho" : "";
          return `<option value="${escapeHtml(cycle.id)}" ${cycle.id === state.selectedCycleId ? "selected" : ""}>${escapeHtml(formatPeriod(cycle))} · ${escapeHtml(cycle.target)}${status}</option>`;
        }).join("");
      }

      function render() {
        const cycles = buildCycles();
        ensureSelectedCycle(cycles);
        const cycle = selectedCycle(cycles);
        renderPeriodOptions(cycles);

        refs.statPeriod.textContent = shortPeriod(cycle);
        refs.periodLabel.textContent = cycle
          ? `${SHORT_DATE_FORMATTER.format(parseDate(cycle.validFrom))} até ${SHORT_DATE_FORMATTER.format(parseDate(cycle.validUntil))}`
          : "Cadastre o primeiro período";
        refs.periodActions.hidden = !cycle || !isManager(session);
        refs.publishPeriod.hidden = !cycle || cycle.status === "published";
        refs.empty.hidden = Boolean(cycle);
        refs.list.hidden = !cycle;
        refs.list.innerHTML = cycle
          ? [1, 2, 3, 4, 5].map(function (weekday) { return menuCard(cycle, weekday); }).join("")
          : "";
      }

      function renderTurmas(selected) {
        refs.turmaList.innerHTML = state.turmas.map(function (turma) {
          const checked = selected.includes(turma.nome);
          return `
            <label class="menu-target-option">
              <input type="checkbox" value="${escapeHtml(turma.nome)}" ${checked ? "checked" : ""}>
              <span><strong>${escapeHtml(turma.nome)}</strong><small>${escapeHtml(turma.turno || "")}</small></span>
            </label>
          `;
        }).join("");
        refs.turmaEmpty.hidden = Boolean(state.turmas.length);
      }

      function syncAudience() {
        refs.targetBlock.hidden = refs.audience.value !== "selected";
      }

      function fillEditor(cycle) {
        const currentYear = new Date().getFullYear();
        const template = cycle?.records[0] || null;
        state.editingCycleId = cycle?.id || "";
        refs.periodYear.value = cycle?.periodYear || currentYear;
        refs.periodType.value = cycle?.periodType && cycle.periodType !== "custom" ? cycle.periodType : "year";
        refs.audience.value = template?.targetTurmas?.length ? "selected" : "all";
        refs.allergens.value = template?.allergens || "";
        refs.notes.value = template?.notes || "";
        refs.dayRows.forEach(function (row) {
          const weekday = Number(row.dataset.menuDay || 0) + 1;
          const record = cycle?.records.find(function (menu) {
            return Number(menu.weekday || parseDate(menu.menuDate).getDay()) === weekday;
          });
          const mealMap = new Map(normalizeMeals(record?.meals).map(function (meal) {
            return [meal.type, meal.description];
          }));
          row.querySelectorAll("[data-menu-meal]").forEach(function (input) {
            input.value = mealMap.get(input.dataset.menuMeal) || "";
          });
        });
        renderTurmas(template?.targetTurmas || []);
        syncAudience();
      }

      function openEditor(cycle) {
        refs.editorTitle.textContent = cycle ? "Editar cardápio recorrente" : "Novo cardápio recorrente";
        fillEditor(cycle || null);
        refs.editorFeedback.textContent = "";
        refs.editorFeedback.className = "feedback";
        setModalOpen(refs.modal, true);
        setTimeout(function () { refs.periodYear.focus(); }, 50);
      }

      function closeEditor() {
        setModalOpen(refs.modal, false);
      }

      async function publishCycle(cycle) {
        for (const record of cycle.records) {
          const saved = await window.AgendaGamaDataStore.save("menus", { ...record, status: "published" }, []);
          state.menus = [saved].concat(state.menus.filter(function (menu) { return menu.id !== saved.id; }));
        }
      }

      async function deleteCycle(cycle) {
        for (const record of cycle.records) {
          await window.AgendaGamaDataStore.remove("menus", record.id, []);
          state.menus = state.menus.filter(function (menu) { return menu.id !== record.id; });
        }
      }

      refs.newButton.hidden = !isManager(session);
      refs.newButton.textContent = "Novo período";
      refs.newButton.addEventListener("click", function () { openEditor(null); });
      refs.periodFilter.addEventListener("change", function () {
        state.selectedCycleId = refs.periodFilter.value;
        state.expandedWeekdays = new Set([new Date().getDay()]);
        render();
      });
      refs.editPeriod.addEventListener("click", function () {
        const cycle = selectedCycle(buildCycles());
        if (cycle && isManager(session)) openEditor(cycle);
      });
      refs.publishPeriod.addEventListener("click", async function () {
        const cycle = selectedCycle(buildCycles());
        if (!cycle || !isManager(session)) return;
        refs.publishPeriod.disabled = true;
        try {
          await publishCycle(cycle);
          setFeedback("Cardápio publicado para todo o período.", "success");
          render();
        } catch (error) {
          setFeedback(error.message || "Não foi possível publicar o período.", "error");
        } finally {
          refs.publishPeriod.disabled = false;
        }
      });
      refs.deletePeriod.addEventListener("click", async function () {
        const cycle = selectedCycle(buildCycles());
        if (!cycle || !isManager(session)) return;
        if (!window.confirm(`Excluir todo o cardápio de ${formatPeriod(cycle)}?`)) return;
        refs.deletePeriod.disabled = true;
        try {
          await deleteCycle(cycle);
          state.selectedCycleId = "";
          setFeedback("Cardápio do período excluído.", "success");
          render();
        } catch (error) {
          setFeedback(error.message || "Não foi possível excluir o período.", "error");
        } finally {
          refs.deletePeriod.disabled = false;
        }
      });
      refs.audience.addEventListener("change", syncAudience);
      refs.selectAllTurmas.addEventListener("click", function () {
        refs.turmaList.querySelectorAll("input").forEach(function (input) { input.checked = true; });
      });
      refs.clearTurmas.addEventListener("click", function () {
        refs.turmaList.querySelectorAll("input").forEach(function (input) { input.checked = false; });
      });
      refs.editorClose.addEventListener("click", closeEditor);
      refs.editorCancel.addEventListener("click", closeEditor);
      refs.modal.querySelector("[data-menu-close-editor]").addEventListener("click", closeEditor);

      refs.editor.addEventListener("submit", async function (event) {
        event.preventDefault();
        const submitter = event.submitter;
        const year = Number(refs.periodYear.value);
        const periodType = refs.periodType.value;
        const targetTurmas = refs.audience.value === "selected"
          ? Array.from(refs.turmaList.querySelectorAll("input:checked")).map(function (input) { return input.value; })
          : [];
        if (!Number.isInteger(year) || year < 2020 || year > 2100) {
          refs.editorFeedback.textContent = "Informe um ano válido.";
          refs.editorFeedback.className = "feedback error";
          return;
        }
        if (refs.audience.value === "selected" && !targetTurmas.length) {
          refs.editorFeedback.textContent = "Selecione pelo menos uma turma.";
          refs.editorFeedback.className = "feedback error";
          return;
        }

        const rows = refs.dayRows.map(function (row) {
          const weekday = Number(row.dataset.menuDay || 0) + 1;
          const meals = Array.from(row.querySelectorAll("[data-menu-meal]")).map(function (input) {
            return { type: input.dataset.menuMeal, description: input.value.trim() };
          }).filter(function (meal) { return meal.description; });
          return { weekday: weekday, meals: meals };
        });
        if (rows.some(function (row) { return row.meals.length !== 3; })) {
          refs.editorFeedback.textContent = "Preencha as três refeições de segunda a sexta.";
          refs.editorFeedback.className = "feedback error";
          return;
        }

        const bounds = periodBounds(year, periodType);
        const firstMonday = firstMondayOnOrAfter(bounds.validFrom);
        const cycleId = state.editingCycleId || createId();
        const previousCycle = buildCycles().find(function (cycle) { return cycle.id === state.editingCycleId; }) || null;
        const status = submitter?.dataset.saveStatus || "published";
        submitter.disabled = true;
        refs.editorFeedback.textContent = "Salvando o cardápio do período...";
        refs.editorFeedback.className = "feedback";

        try {
          for (const row of rows) {
            const current = previousCycle?.records.find(function (record) {
              return Number(record.weekday || parseDate(record.menuDate).getDay()) === row.weekday;
            });
            const saved = await window.AgendaGamaDataStore.save("menus", {
              ...current,
              id: current?.id || createId(),
              cycleId: cycleId,
              weekday: row.weekday,
              periodType: periodType,
              periodYear: year,
              validFrom: bounds.validFrom,
              validUntil: bounds.validUntil,
              menuDate: dateKey(addDays(firstMonday, row.weekday - 1)),
              title: `Cardápio de ${DAY_NAMES[row.weekday - 1]}`,
              status: status,
              targetTurmas: targetTurmas,
              meals: row.meals,
              allergens: refs.allergens.value.trim(),
              notes: refs.notes.value.trim(),
              authorUserId: current?.authorUserId || session.userId,
              authorName: current?.authorName || session.name,
              authorEmail: current?.authorEmail || session.email
            }, []);
            state.menus = [saved].concat(state.menus.filter(function (menu) { return menu.id !== saved.id; }));
          }
          state.selectedCycleId = cycleId;
          state.expandedWeekdays = new Set([1]);
          closeEditor();
          setFeedback(status === "draft" ? "Rascunho do período salvo." : "Cardápio publicado para todo o período.", "success");
          render();
        } catch (error) {
          refs.editorFeedback.textContent = error.message || "Não foi possível salvar o cardápio.";
          refs.editorFeedback.className = "feedback error";
        } finally {
          submitter.disabled = false;
        }
      });

      refs.list.addEventListener("click", function (event) {
        const toggle = event.target.closest("[data-menu-toggle-day]");
        if (!toggle) return;
        const weekday = Number(toggle.dataset.menuToggleDay);
        if (state.expandedWeekdays.has(weekday)) state.expandedWeekdays.delete(weekday);
        else state.expandedWeekdays.add(weekday);
        render();
      });

      render();
    }

    ensureShellContent(function () {
      const session = window.AgendaGamaAuth.getSession();
      if (session) {
        init(session);
        return;
      }
      window.addEventListener("agenda-shell-ready", function handleReady(event) {
        window.removeEventListener("agenda-shell-ready", handleReady);
        init(event.detail?.session || null);
      });
    });
  }

  window.AgendaGamaSchoolMenu = { mount: mount };
})();
