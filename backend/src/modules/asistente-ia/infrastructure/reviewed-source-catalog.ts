import type { ReviewedSource, ReviewedSourceCatalog } from '../application/conversation-ports.js';

function valid(source: ReviewedSource, now: Date): boolean {
  const fields = [source.authority, source.jurisdiction, source.reference, source.title, source.version,
    source.reviewedAt, source.validUntil, source.reusePermission, source.professionalReviewer,
    source.productName, source.educationalStatement];
  return fields.every(value => typeof value === 'string' && value.trim().length > 0) &&
    source.approvedForTest === true && source.reusePermission === 'TEST_ONLY' &&
    source.reference.startsWith('test://') &&
    Number.isFinite(Date.parse(source.reviewedAt)) && Number.isFinite(Date.parse(source.validUntil)) &&
    Date.parse(source.reviewedAt) <= now.getTime() && Date.parse(source.validUntil) > now.getTime();
}

/** TEST-only registry; the production composition supplies an empty instance. */
export class InMemoryReviewedSourceCatalog implements ReviewedSourceCatalog {
  constructor(private readonly candidates: readonly ReviewedSource[]) {}
  lookup(term: string, now: Date): ReviewedSource | null {
    const query = term.toLocaleLowerCase('es');
    const matches = this.candidates.filter(source => valid(source, now) &&
      (query.includes(source.productName.toLocaleLowerCase('es')) ||
        (source.categoryKey && query.includes(source.categoryKey.toLocaleLowerCase('es')))));
    return matches.length === 1 ? matches[0] : null;
  }
}
