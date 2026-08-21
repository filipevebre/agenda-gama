(function () {
  const BUCKET_NAME = "student-health-documents";
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const ACCEPTED_FILE_TYPES = new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp"
  ]);
  const CATEGORY_LABELS = {
    food_restriction: "Restrição alimentar",
    health_condition: "Atenção de saúde",
    other: "Outra atenção"
  };

  function canAccess(session) {
    return ["administrador", "funcionarios"].includes(session?.role);
  }

  function categoryLabel(category) {
    return CATEGORY_LABELS[category] || CATEGORY_LABELS.other;
  }

  function validateFile(file) {
    if (!file) return;
    if (!ACCEPTED_FILE_TYPES.has(String(file.type || "").toLowerCase())) {
      throw new Error("Envie o laudo em PDF, JPG, PNG ou WEBP.");
    }
    if (Number(file.size || 0) > MAX_FILE_SIZE) {
      throw new Error("O laudo deve ter no máximo 10 MB.");
    }
  }

  function safeFileName(name) {
    const source = String(name || "laudo")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return source || "laudo";
  }

  async function removeDocument(path) {
    const normalizedPath = String(path || "").trim();
    if (!normalizedPath) return;
    const client = await window.AgendaGamaSupabase.getClient();
    if (!client) throw new Error("Supabase não configurado.");
    const { error } = await client.storage.from(BUCKET_NAME).remove([normalizedPath]);
    if (error) throw error;
  }

  async function uploadDocument(studentId, file) {
    validateFile(file);
    const session = window.AgendaGamaAuth?.getSession?.() || null;
    if (!canAccess(session) || !session?.userId) {
      throw new Error("Seu perfil não tem permissão para enviar laudos.");
    }

    const client = await window.AgendaGamaSupabase.getClient();
    if (!client) throw new Error("Supabase não configurado.");
    const path = `${session.userId}/${studentId}/${Date.now()}-${safeFileName(file.name)}`;
    const { error } = await client.storage.from(BUCKET_NAME).upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false
    });
    if (error) throw error;
    return path;
  }

  async function createSignedDocumentUrl(path, expiresInSeconds) {
    const normalizedPath = String(path || "").trim();
    if (!normalizedPath) return "";
    const client = await window.AgendaGamaSupabase.getClient();
    if (!client) throw new Error("Supabase não configurado.");
    const { data, error } = await client.storage
      .from(BUCKET_NAME)
      .createSignedUrl(normalizedPath, Number(expiresInSeconds || 900));
    if (error) throw error;
    return data?.signedUrl || "";
  }

  async function listRecords() {
    const session = window.AgendaGamaAuth?.getSession?.() || null;
    if (!canAccess(session)) return [];
    return await window.AgendaGamaDataStore.list("studentHealth", []);
  }

  async function syncRecord(options) {
    const session = window.AgendaGamaAuth?.getSession?.() || null;
    if (!canAccess(session)) {
      throw new Error("Seu perfil não tem permissão para alterar informações de saúde.");
    }

    const studentId = String(options?.studentId || "").trim();
    const category = String(options?.category || "").trim();
    const conditionName = String(options?.conditionName || "").trim();
    const observation = String(options?.observation || "").trim();
    const file = options?.file || null;
    const existingRecord = options?.existingRecord || null;
    const removeExistingDocument = Boolean(options?.removeExistingDocument);

    if (!studentId) throw new Error("Não foi possível identificar o aluno.");
    if (!category) {
      if (existingRecord?.id) {
        await window.AgendaGamaDataStore.remove("studentHealth", existingRecord.id, []);
        if (existingRecord.documentPath) {
          await removeDocument(existingRecord.documentPath).catch(function (error) {
            console.warn("[Agenda Gama] Não foi possível remover o laudo antigo.", error);
          });
        }
      }
      return null;
    }
    if (!CATEGORY_LABELS[category]) throw new Error("Selecione um tipo de atenção válido.");
    if (!conditionName) throw new Error("Informe o que o aluno tem.");
    if (conditionName.length > 160) throw new Error("A condição específica deve ter no máximo 160 caracteres.");
    if (!observation) throw new Error("Escreva os cuidados e as orientações importantes sobre o aluno.");
    validateFile(file);

    let uploadedPath = "";
    try {
      uploadedPath = file ? await uploadDocument(studentId, file) : "";
      const nextDocumentPath = uploadedPath || (removeExistingDocument ? "" : existingRecord?.documentPath || "");
      const nextDocumentName = file?.name || (removeExistingDocument ? "" : existingRecord?.documentName || "");
      const nextDocumentMimeType = file?.type || (removeExistingDocument ? "" : existingRecord?.documentMimeType || "");
      const savedRecord = await window.AgendaGamaDataStore.save("studentHealth", {
        id: existingRecord?.id || null,
        studentId,
        category,
        conditionName,
        observation,
        documentPath: nextDocumentPath,
        documentName: nextDocumentName,
        documentMimeType: nextDocumentMimeType,
        createdByUserId: existingRecord?.createdByUserId || session.userId,
        createdByName: existingRecord?.createdByName || session.name || "",
        active: true
      }, []);

      if (existingRecord?.documentPath
        && existingRecord.documentPath !== nextDocumentPath
        && (uploadedPath || removeExistingDocument)) {
        await removeDocument(existingRecord.documentPath).catch(function (error) {
          console.warn("[Agenda Gama] Não foi possível remover o laudo substituído.", error);
        });
      }
      return savedRecord;
    } catch (error) {
      if (uploadedPath) {
        await removeDocument(uploadedPath).catch(function () {});
      }
      throw error;
    }
  }

  async function removeRecord(record) {
    if (!record?.id) return;
    await window.AgendaGamaDataStore.remove("studentHealth", record.id, []);
    if (record.documentPath) {
      await removeDocument(record.documentPath).catch(function (error) {
        console.warn("[Agenda Gama] Não foi possível remover o laudo do aluno excluído.", error);
      });
    }
  }

  window.AgendaGamaStudentHealth = {
    canAccess,
    categoryLabel,
    createSignedDocumentUrl,
    listRecords,
    removeRecord,
    syncRecord,
    validateFile
  };
})();
