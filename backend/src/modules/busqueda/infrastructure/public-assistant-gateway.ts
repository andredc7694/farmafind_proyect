import type { SearchPublicOffers } from '../application/search-public-offers.js';
import type { PublicOfferRepository } from '../application/ports.js';
import type { PublicKnowledgeGateway } from '../contracts/public-knowledge.js';
import type { CanonicalPublicQuery, PublicOrder } from '../domain/public-query.js';
function query(term:string,order:PublicOrder):CanonicalPublicQuery{return{term:term.normalize('NFC').trim().toLocaleLowerCase('es').slice(0,120),minimumPrice:null,maximumPrice:null,order,latitude:null,longitude:null,page:1,pageSize:20};}
export class F03PublicAssistantGateway implements PublicKnowledgeGateway {
  constructor(private readonly searchUseCase:SearchPublicOffers,private readonly repository:PublicOfferRepository){}
  search(term:string){return this.searchUseCase.execute(query(term,'relevancia'));}
  compare(term:string){return this.searchUseCase.execute(query(term,'precio_asc'));}
  pharmacy(id:string){return this.repository.pharmacy(id);}
}
