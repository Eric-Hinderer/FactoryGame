/* Progression safeguards: mission authorizations and a renewable research funding path. */

const FF10_CRITICAL_TECH_BY_MISSION = {
  2: ["industrialAutomation"],
  3: ["industrialAutomation", "advancedElectronics"],
  4: ["industrialAutomation", "advancedElectronics", "researchSynthesis"]
};

function ff10AuthorizeMissionCriticalTech(showNotice = true) {
  if (!state) return [];
  state.techUnlocked = Array.isArray(state.techUnlocked) ? state.techUnlocked : [];
  state.missionTechNotices = Array.isArray(state.missionTechNotices) ? state.missionTechNotices : [];

  const required = FF10_CRITICAL_TECH_BY_MISSION[state.missionIndex] || [];
  const newlyUnlocked = [];
  for (const techKey of required) {
    if (!state.techUnlocked.includes(techKey)) {
      state.techUnlocked.push(techKey);
      newlyUnlocked.push(techKey);
    }
  }
  state.techUnlocked = [...new Set(state.techUnlocked)];

  if (newlyUnlocked.length && showNotice) {
    const noticeKey = `mission-${state.missionIndex}`;
    if (!state.missionTechNotices.includes(noticeKey)) {
      state.missionTechNotices.push(noticeKey);
      const names = newlyUnlocked.map(key => TECHS[key]?.name || key).join(" and ");
      toast(`Mission authorization granted: ${names}.`, "good");
      setStatus("Command released mission-critical technology to prevent a research dead-end.");
    }
  }
  return newlyUnlocked;
}

const FF10_BASE_ENSURE_PROGRESSION = ensureProgressionState;
ensureProgressionState = function () {
  FF10_BASE_ENSURE_PROGRESSION();
  state.version = Math.max(5, state.version || 0);
  state.fundedResearch = Math.max(0, Number(state.fundedResearch) || 0);
  ff10AuthorizeMissionCriticalTech(false);
};

const FF10_BASE_CHECK_MISSION = checkMissionProgress;
checkMissionProgress = function () {
  const previousMission = state.missionIndex;
  FF10_BASE_CHECK_MISSION();
  if (state.missionIndex !== previousMission) {
    const unlocked = ff10AuthorizeMissionCriticalTech(true);
    if (unlocked.length) {
      updateBuildToolAvailability();
      updateInspector();
      renderTechTree();
      saveGame();
    }
  }
};

function ff10ResearchFundingCost() {
  return 200;
}

function ff10FundResearch() {
  ensureProgressionState();
  const cost = ff10ResearchFundingCost();
  if (state.credits < cost) {
    toast(`Research funding requires ₡ ${cost}. Deliver materials to the Command Core for credits.`, "bad");
    errorSound();
    return;
  }
  state.credits -= cost;
  state.researchPoints += 1;
  state.fundedResearch += 1;
  updateHUD(true);
  renderTechTree();
  saveGame();
  toast(`Field research funded: +1 research point for ₡ ${cost}.`, "good");
  clickSound(860, 0.1);
}

function ff10InstallResearchFundingControl() {
  const balance = document.querySelector("#tech-screen .tech-balance");
  if (!balance || document.getElementById("fund-research-button")) return;

  const button = document.createElement("button");
  button.id = "fund-research-button";
  button.className = "tech-fund-button";
  button.addEventListener("click", ff10FundResearch);
  balance.after(button);

  if (!document.getElementById("progression-safeguard-styles")) {
    const style = document.createElement("style");
    style.id = "progression-safeguard-styles";
    style.textContent = `
      .tech-fund-button{min-width:190px;min-height:48px;margin-left:10px;padding:8px 13px;border:1px solid rgba(239,184,91,.45);background:rgba(104,72,27,.3);color:#efc97d;cursor:pointer;font-size:10px;font-weight:800;line-height:1.35;text-transform:uppercase}
      .tech-fund-button:hover:not(:disabled){border-color:#efb85b;background:rgba(130,88,31,.44)}
      .tech-fund-button:disabled{cursor:not-allowed;opacity:.45}
    `;
    document.head.appendChild(style);
  }
}

const FF10_BASE_RENDER_TECH = renderTechTree;
renderTechTree = function () {
  ensureProgressionState();
  FF10_BASE_RENDER_TECH();
  ff10InstallResearchFundingControl();
  const button = document.getElementById("fund-research-button");
  if (button) {
    const cost = ff10ResearchFundingCost();
    button.disabled = state.credits < cost;
    button.innerHTML = `Fund field research<br>₡ ${cost} → 1 ◈`;
    button.title = "A renewable fallback: convert delivery credits into one research point.";
  }
};

ensureProgressionState();
const ff10InitialMissionUnlocks = ff10AuthorizeMissionCriticalTech(true);
if (ff10InitialMissionUnlocks.length) saveGame();
updateBuildToolAvailability();
updateHUD(true);
renderTechTree();
