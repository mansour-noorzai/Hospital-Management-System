import api from './api';

export async function downloadDocumentPdf(documentId: string, filename?: string) {
  const response = await api.get(`/documents/${documentId}/pdf`, { responseType: 'blob' });
  const url = URL.createObjectURL(response.data as Blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename || `medical-document-${documentId}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
