(function () {
  const MEAL_LABELS = {
    breakfast: "Café da manhã",
    morning_snack: "Lanche da manhã",
    lunch: "Almoço",
    afternoon_snack: "Lanche da tarde",
    dinner: "Jantar"
  };
  const DAY_FORMATTER = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

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

  function startOfWeek(date) {
    const next = new Date(date);
    const day = next.getDay();
    next.setDate(next.getDate() - (day === 0 ? 6 : day - 1));
    next.setHours(12, 0, 0, 0);
    return next;
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
    const anyOpen = Array.from(document.querySelectorAll(".app-modal")).some(function (item) { return !item.hidden; });
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
    }).filter(function (meal) { return meal.type && meal.description; });
  }

  function mount() {
    async function init(session) {
      if (!session || !window.AgendaGamaDataStore) return;

      const refs = {
        newButton: document.getElementById("menu-new"),
        statWeek: document.getElementById("menu-stat-week"),
        statPublished: document.getElementById("menu-stat-published"),
        statUpcoming: document.getElementById("menu-stat-upcoming"),
        previousWeek: document.getElementById("menu-previous-week"),
        nextWeek: document.getElementById("menu-next-week"),
        today: document.getElementById("menu-today"),
        weekDate: document.getElementById("menu-week-date"),
        weekLabel: document.getElementById("menu-week-label"),
        list: document.getElementById("menu-list"),
        empty: document.getElementById("menu-empty"),
        feedback: document.getElementById("menu-feedback"),
        modal: document.getElementById("menu-editor-modal"),
        editor: document.getElementById("menu-editor"),
        editorTitle: document.getElementById("menu-editor-title"),
        editorClose: document.getElementById("menu-editor-close"),
        editorCancel: document.getElementById("menu-editor-cancel"),
        editorFeedback: document.getElementById("menu-editor-feedback"),
        date: document.getElementById("menu-date"),
        title: document.getElementById("menu-title"),
        audience: document.getElementById("menu-audience"),
        targetBlock: document.getElementById("menu-target-block"),
        turmaList: document.getElementById("menu-turma-list"),
        turmaEmpty: document.getElementById("menu-turma-empty"),
        selectAllTurmas: document.getElementById("menu-select-all-turmas"),
        clearTurmas: document.getElementById("menu-clear-turmas"),
        mealInputs: Array.from(document.querySelectorAll("[data-menu-meal]")),
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
        selectedWeek: startOfWeek(new Date()),
        editingId: null,
        expandedIds: new Set()
      };
      state.menus.forEach(function (menu) {
        if (menu.menuDate === dateKey(new Date())) state.expandedIds.add(menu.id);
      });

      function setFeedback(message, type) {
        refs.feedback.textContent = message || "";
        refs.feedback.className = `feedback${type ? ` ${type}` : ""}`;
      }

      function weekMenus() {
        const first = dateKey(state.selectedWeek);
        const last = dateKey(addDays(state.selectedWeek, 6));
        return state.menus.filter(function (menu) { return menu.menuDate >= first && menu.menuDate <= last; });
      }

      function renderStats() {
        const today = dateKey(new Date());
        refs.statWeek.textContent = weekMenus().length;
        refs.statPublished.textContent = state.menus.filter(function (menu) { return menu.status === "published"; }).length;
        refs.statUpcoming.textContent = state.menus.filter(function (menu) {
          return menu.status === "published" && menu.menuDate >= today;
        }).length;
      }

      function mealList(menu) {
        const meals = normalizeMeals(menu.meals);
        return meals.map(function (meal) {
          return `
            <div class="menu-meal-item">
              <span class="menu-meal-icon">${escapeHtml((MEAL_LABELS[meal.type] || "Refeição").slice(0, 1))}</span>
              <div><strong>${escapeHtml(MEAL_LABELS[meal.type] || "Refeição")}</strong><p>${escapeHtml(meal.description)}</p></div>
            </div>
          `;
        }).join("");
      }

      function menuCard(menu) {
        const expanded = state.expandedIds.has(menu.id);
        const targets = menu.targetTurmas?.length ? menu.targetTurmas.join(", ") : "Toda a escola";
        const manager = isManager(session);
        return `
          <article class="menu-day-card ${menu.menuDate === dateKey(new Date()) ? "is-today" : ""}">
            <button class="menu-day-summary" type="button" data-menu-toggle="${escapeHtml(menu.id)}" aria-expanded="${expanded}">
              <span class="menu-day-date"><strong>${escapeHtml(String(parseDate(menu.menuDate).getDate()).padStart(2, "0"))}</strong><small>${escapeHtml(parseDate(menu.menuDate).toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""))}</small></span>
              <span class="menu-day-copy">
                <small>${escapeHtml(DAY_FORMATTER.format(parseDate(menu.menuDate)))}</small>
                <strong>${escapeHtml(menu.title)}</strong>
                <span>${normalizeMeals(menu.meals).length} refeição(ões) · ${escapeHtml(targets)}</span>
              </span>
              <span class="status-badge menu-status-${escapeHtml(menu.status)}">${menu.status === "published" ? "Publicado" : "Rascunho"}</span>
              <span class="menu-expand-icon">${expanded ? "−" : "+"}</span>
            </button>
            <div class="menu-day-details" ${expanded ? "" : "hidden"}>
              <div class="menu-meal-list">${mealList(menu) || '<p class="muted">Nenhuma refeição informada.</p>'}</div>
              ${menu.allergens ? `<div class="menu-info-note menu-allergen-note"><strong>Alergênicos</strong><span>${escapeHtml(menu.allergens)}</span></div>` : ""}
              ${menu.notes ? `<div class="menu-info-note"><strong>Observações</strong><span>${escapeHtml(menu.notes)}</span></div>` : ""}
              ${manager ? `
                <div class="menu-card-actions">
                  <button class="btn btn-secondary btn-sm" type="button" data-menu-edit="${escapeHtml(menu.id)}">Editar</button>
                  ${menu.status === "draft" ? `<button class="btn btn-primary btn-sm" type="button" data-menu-publish="${escapeHtml(menu.id)}">Publicar</button>` : ""}
                  <button class="btn btn-danger btn-sm" type="button" data-menu-delete="${escapeHtml(menu.id)}">Excluir</button>
                </div>
              ` : ""}
            </div>
          </article>
        `;
      }

      function render() {
        const first = state.selectedWeek;
        const last = addDays(first, 6);
        refs.weekLabel.textContent = `${SHORT_DATE_FORMATTER.format(first)} a ${SHORT_DATE_FORMATTER.format(last)}`;
        refs.weekDate.value = dateKey(first);
        const visible = weekMenus().sort(function (left, right) {
          return left.menuDate.localeCompare(right.menuDate) || String(left.title).localeCompare(String(right.title), "pt-BR");
        });
        refs.list.innerHTML = visible.map(menuCard).join("");
        refs.empty.hidden = Boolean(visible.length);
        renderStats();
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

      function openEditor(menu) {
        state.editingId = menu?.id || null;
        refs.editorTitle.textContent = menu ? "Editar cardápio" : "Novo cardápio";
        refs.date.value = menu?.menuDate || dateKey(new Date());
        refs.title.value = menu?.title || "Cardápio do dia";
        refs.audience.value = menu?.targetTurmas?.length ? "selected" : "all";
        refs.allergens.value = menu?.allergens || "";
        refs.notes.value = menu?.notes || "";
        const mealMap = new Map(normalizeMeals(menu?.meals).map(function (meal) { return [meal.type, meal.description]; }));
        refs.mealInputs.forEach(function (input) { input.value = mealMap.get(input.dataset.menuMeal) || ""; });
        renderTurmas(menu?.targetTurmas || []);
        syncAudience();
        refs.editorFeedback.textContent = "";
        setModalOpen(refs.modal, true);
        setTimeout(function () { refs.date.focus(); }, 50);
      }

      function closeEditor() {
        setModalOpen(refs.modal, false);
        state.editingId = null;
      }

      refs.newButton.hidden = !isManager(session);
      refs.newButton.addEventListener("click", function () { openEditor(null); });
      refs.previousWeek.addEventListener("click", function () {
        state.selectedWeek = addDays(state.selectedWeek, -7);
        render();
      });
      refs.nextWeek.addEventListener("click", function () {
        state.selectedWeek = addDays(state.selectedWeek, 7);
        render();
      });
      refs.today.addEventListener("click", function () {
        state.selectedWeek = startOfWeek(new Date());
        render();
      });
      refs.weekDate.addEventListener("change", function () {
        state.selectedWeek = startOfWeek(parseDate(refs.weekDate.value));
        render();
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
        const targetTurmas = refs.audience.value === "selected"
          ? Array.from(refs.turmaList.querySelectorAll("input:checked")).map(function (input) { return input.value; })
          : [];
        if (refs.audience.value === "selected" && !targetTurmas.length) {
          refs.editorFeedback.textContent = "Selecione pelo menos uma turma.";
          refs.editorFeedback.className = "feedback error";
          return;
        }
        const meals = refs.mealInputs.map(function (input) {
          return { type: input.dataset.menuMeal, description: input.value.trim() };
        }).filter(function (meal) { return meal.description; });
        if (!meals.length) {
          refs.editorFeedback.textContent = "Informe pelo menos uma refeição.";
          refs.editorFeedback.className = "feedback error";
          return;
        }
        const current = state.menus.find(function (item) { return item.id === state.editingId; });
        const payload = {
          ...current,
          id: current?.id || null,
          menuDate: refs.date.value,
          title: refs.title.value.trim(),
          status: submitter?.dataset.saveStatus || current?.status || "published",
          targetTurmas: targetTurmas,
          meals: meals,
          allergens: refs.allergens.value.trim(),
          notes: refs.notes.value.trim(),
          authorUserId: current?.authorUserId || session.userId,
          authorName: current?.authorName || session.name,
          authorEmail: current?.authorEmail || session.email
        };
        submitter.disabled = true;
        refs.editorFeedback.textContent = "Salvando...";
        try {
          const saved = await window.AgendaGamaDataStore.save("menus", payload, []);
          state.menus = [saved].concat(state.menus.filter(function (item) { return item.id !== saved.id; }));
          state.selectedWeek = startOfWeek(parseDate(saved.menuDate));
          state.expandedIds.add(saved.id);
          closeEditor();
          setFeedback(saved.status === "published" ? "Cardápio publicado." : "Rascunho salvo.", "success");
          render();
        } catch (error) {
          refs.editorFeedback.textContent = error.message || "Não foi possível salvar o cardápio.";
          refs.editorFeedback.className = "feedback error";
        } finally {
          submitter.disabled = false;
        }
      });
      refs.list.addEventListener("click", async function (event) {
        const toggleId = event.target.closest("[data-menu-toggle]")?.dataset.menuToggle;
        const editId = event.target.closest("[data-menu-edit]")?.dataset.menuEdit;
        const publishId = event.target.closest("[data-menu-publish]")?.dataset.menuPublish;
        const deleteId = event.target.closest("[data-menu-delete]")?.dataset.menuDelete;
        const id = toggleId || editId || publishId || deleteId;
        const menu = state.menus.find(function (item) { return item.id === id; });
        if (!menu) return;
        if (toggleId) {
          if (state.expandedIds.has(menu.id)) state.expandedIds.delete(menu.id);
          else state.expandedIds.add(menu.id);
          render();
        }
        if (editId && isManager(session)) openEditor(menu);
        if (publishId && isManager(session)) {
          try {
            const saved = await window.AgendaGamaDataStore.save("menus", { ...menu, status: "published" }, []);
            state.menus = [saved].concat(state.menus.filter(function (item) { return item.id !== saved.id; }));
            setFeedback("Cardápio publicado.", "success");
            render();
          } catch (error) {
            setFeedback(error.message || "Não foi possível publicar.", "error");
          }
        }
        if (deleteId && isManager(session)) {
          if (!window.confirm(`Excluir o cardápio de ${SHORT_DATE_FORMATTER.format(parseDate(menu.menuDate))}?`)) return;
          try {
            await window.AgendaGamaDataStore.remove("menus", menu.id, []);
            state.menus = state.menus.filter(function (item) { return item.id !== menu.id; });
            setFeedback("Cardápio excluído.", "success");
            render();
          } catch (error) {
            setFeedback(error.message || "Não foi possível excluir.", "error");
          }
        }
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
