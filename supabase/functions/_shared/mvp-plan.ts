export type MvpPlan = {
  ideaId: string;
  ideaTitle: string;
  summary: string;
  mustHaveFeatures: { name: string; description: string }[];
  laterFeatures: { name: string; description: string }[];
  screens: { name: string; purpose: string; wireframe: string[] }[];
  schedule: { period: string; goal: string; tasks: string[] }[];
  teamRoles: { role: string; responsibilities: string[] }[];
  apis: { name: string; purpose: string; method: string }[];
  presentationOrder: string[];
};

type MvpIdea = {
  id: string;
  title: string;
};

const apiMethods = new Set(['GET', 'POST', 'PATCH', 'PUT', 'DELETE']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown, maxLength = 500) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function textList(value: unknown, maxItems: number, maxItemLength = 300) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => text(item, maxItemLength)).filter(Boolean).slice(0, maxItems);
}

function namedDescriptions(value: unknown, maxItems: number) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const name = text(item.name, 120);
    const description = text(item.description, 500);
    return name && description ? [{ name, description }] : [];
  }).slice(0, maxItems);
}

/** Cleans minor provider deviations while rejecting plans with no usable core sections. */
export function normalizeMvpPlan(value: unknown, idea: MvpIdea): MvpPlan | null {
  if (!isRecord(value)) return null;

  const summary = text(value.summary, 1000);
  const mustHaveFeatures = namedDescriptions(value.mustHaveFeatures, 8);
  const laterFeatures = namedDescriptions(value.laterFeatures, 8);
  const screens = Array.isArray(value.screens)
    ? value.screens.flatMap((item) => {
      if (!isRecord(item)) return [];
      const name = text(item.name, 120);
      const purpose = text(item.purpose, 500);
      const wireframe = textList(item.wireframe, 7);
      return name && purpose && wireframe.length > 0 ? [{ name, purpose, wireframe }] : [];
    }).slice(0, 10)
    : [];
  const schedule = Array.isArray(value.schedule)
    ? value.schedule.flatMap((item) => {
      if (!isRecord(item)) return [];
      const period = text(item.period, 120);
      const goal = text(item.goal, 500);
      const tasks = textList(item.tasks, 6);
      return period && goal && tasks.length > 0 ? [{ period, goal, tasks }] : [];
    }).slice(0, 16)
    : [];
  const teamRoles = Array.isArray(value.teamRoles)
    ? value.teamRoles.flatMap((item) => {
      if (!isRecord(item)) return [];
      const role = text(item.role, 120);
      const responsibilities = textList(item.responsibilities, 6);
      return role && responsibilities.length > 0 ? [{ role, responsibilities }] : [];
    }).slice(0, 8)
    : [];
  const apis = Array.isArray(value.apis)
    ? value.apis.flatMap((item) => {
      if (!isRecord(item)) return [];
      const name = text(item.name, 120);
      const purpose = text(item.purpose, 500);
      const method = text(item.method, 10).toUpperCase();
      return name && purpose && apiMethods.has(method) ? [{ name, purpose, method }] : [];
    }).slice(0, 10)
    : [];
  const presentationOrder = textList(value.presentationOrder, 10);

  if (
    !summary ||
    mustHaveFeatures.length === 0 ||
    screens.length === 0 ||
    schedule.length === 0 ||
    teamRoles.length === 0 ||
    presentationOrder.length === 0
  ) {
    return null;
  }

  return {
    ideaId: idea.id,
    ideaTitle: idea.title,
    summary,
    mustHaveFeatures,
    laterFeatures,
    screens,
    schedule,
    teamRoles,
    apis,
    presentationOrder,
  };
}
