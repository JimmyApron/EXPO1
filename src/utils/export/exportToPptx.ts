import type { ExportData } from '../../types/export';
import { createPptx } from './createPptx';
import { safeFileName, saveFile } from './saveFile';

export async function exportToPptx(data: ExportData) {
  await saveFile(await createPptx(data), `${safeFileName(data.projectTitle).slice(0, 80)}_presentation.pptx`, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
}
