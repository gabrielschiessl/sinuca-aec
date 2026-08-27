// Independent from the championship API and its Apps Script selector.
export async function roomRequest(endpoint, payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload), cache: "no-store", signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok || data.erro) {
      throw Object.assign(new Error(data.erro || "Não foi possível acessar a sala."), { status: response.status });
    }
    return data;
  } finally { clearTimeout(timeout); }
}

export const roomStorageKey = (code) => `aec_room_${code}`;
export const normalizeRoomCode = (code) => String(code).toUpperCase().replace(/[\s-]/g, "");

export class ScoreboardRoom {
  constructor({ code, viewer = false, request, storage, onChange }) {
    this.code = code; this.viewer = viewer; this.request = request;
    this.storage = storage; this.onChange = onChange;
    this.version = 0; this.state = null; this.token = "";
    this.pending = null; this.connected = false; this.closed = false;
    this.undoStack = []; this.pendingBefore = null; this.pendingUndo = false;
    this.stopped = false; this.busy = false; this.delay = 2000;
    this.message = "Conectando à sala…";
    if (!viewer) {
      try {
        const saved = JSON.parse(storage.getItem(roomStorageKey(code)) || "{}");
        this.token = saved.token || "";
        this.pending = saved.pending || null;
        this.undoStack = Array.isArray(saved.undoStack) ? saved.undoStack.slice(-100) : [];
        this.pendingBefore = saved.pendingBefore || null;
        this.pendingUndo = saved.pendingUndo === true;
        this.version = Number(saved.version) || 0;
      } catch { /* Viewer fallback if storage is unavailable. */ }
    }
  }
  get editable() { return !!(this.token && this.state && this.connected && !this.pending && !this.closed && !this.viewer); }
  persist() {
    this.storage.setItem(roomStorageKey(this.code), JSON.stringify({ token: this.token, pending: this.pending,
      undoStack: this.undoStack, pendingBefore: this.pendingBefore, pendingUndo: this.pendingUndo, version: this.version }));
  }
  emit() { if (!this.stopped) this.onChange(this); }
  start() { this.tick(); }
  stop() { this.stopped = true; clearTimeout(this.timer); }
  undo() {
    if (!this.editable || !this.undoStack.length) return false;
    return this.submit(this.undoStack.at(-1), true);
  }
  submit(state, undo = false) {
    if (!this.editable) return false;
    this.pendingBefore = structuredClone(this.state);
    this.pendingUndo = undo;
    this.pending = {
      acao: "atualizar", codigo: this.code, controller_token: this.token,
      versao: this.version, comando_id: crypto.randomUUID(), estado: structuredClone(state),
    };
    // Persist before sending, so a reload can retry the exact same command.
    try { this.persist(); }
    catch {
      this.pending = null; this.pendingBefore = null; this.pendingUndo = false;
      this.message = "Armazenamento indisponível. Não foi enviado nenhum ponto.";
      this.emit(); return false;
    }
    this.message = "Salvando…"; this.emit();
    clearTimeout(this.timer); this.tick();
    return true;
  }
  async tick() {
    if (this.stopped || this.busy || this.closed) return;
    this.busy = true;
    const command = this.pending;
    try {
      const data = await this.request(command || {
        acao: "consultar", codigo: this.code, versao: this.state ? this.version : 0,
        ...(this.token ? { controller_token: this.token } : {}),
      });
      if (this.stopped) return;
      if (!command && data.versao !== this.version) this.undoStack = [];
      if (data.estado) this.state = structuredClone(data.estado);
      this.version = data.versao; this.closed = data.encerrada;
      this.connected = true; this.delay = 2000;
      if (command) {
        if (this.pendingUndo) this.undoStack.pop();
        else if (this.pendingBefore) this.undoStack.push(this.pendingBefore);
        this.undoStack = this.undoStack.slice(-100);
        this.pending = null; this.pendingBefore = null; this.pendingUndo = false;
      }
      if (data.controle_ativo === false && this.token) {
        this.token = ""; this.pending = null;
        this.undoStack = []; this.pendingBefore = null; this.pendingUndo = false;
        this.message = "Outro aparelho assumiu o controle. Você está acompanhando.";
      } else this.message = this.closed ? "Sala encerrada." : this.token ? "Controle conectado" : "Acompanhando a sala";
      if (!this.viewer) { try { this.persist(); } catch { /* Memory remains authoritative this session. */ } }
    } catch (error) {
      if (this.stopped) return;
      this.connected = false;
      if ([400, 403, 409, 413, 422].includes(error.status)) {
        this.pending = null; this.version = 0;
        this.undoStack = []; this.pendingBefore = null; this.pendingUndo = false;
        if (error.status === 403) this.token = "";
        try { this.persist(); } catch {}
        this.message = `${error.message} Atualizando o placar da sala…`;
      } else if ([404, 410].includes(error.status)) {
        this.closed = true; this.pending = null; this.token = "";
        this.undoStack = []; this.pendingBefore = null; this.pendingUndo = false;
        try { if (!this.viewer) this.persist(); } catch {}
        this.message = error.message;
      } else {
        this.message = this.pending ? "Sem confirmação. Reconectando sem repetir os pontos…" : "Sem conexão. Tentando novamente…";
      }
      this.delay = error.status === 429 ? 60000 : Math.min(this.delay * 2, 30000);
    } finally {
      this.busy = false;
      if (!this.stopped) {
        this.emit();
        if (!this.closed) this.timer = setTimeout(() => this.tick(), this.connected && this.pending ? 0 : this.delay);
      }
    }
  }
}
