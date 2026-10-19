import { getSetting } from "./settings";
import { DEFAULT_TEMPLATES, templatesSchema } from "./templates";

export async function getTemplates() {
  return getSetting("templates", templatesSchema, DEFAULT_TEMPLATES);
}
