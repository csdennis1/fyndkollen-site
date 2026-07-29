// pricedb-web.js — DE RENA funktionerna ur extension/priceDB.js (ingen chrome.storage).
// Används av analysera.html för att räkna product_key EXAKT som tillägget → servern kan
// grunda värderingen i verifierade Tradera-slutpriser (samma moat).
//
// ⚠️ INVARIANT — TREDJE KOPIAN. detectCategory / bucketKey / productKey / CATS / mapPageCategory
// MÅSTE hållas ordagrant identiska med:
//   1) extension/priceDB.js  (klienten)
//   2) backend/supabase-tradera-ingest-function.ts  (ingesten)
//   3) denna fil  (webben)
// Ändras kategorilogiken i en → ändra i ALLA TRE, annars hamnar webb-appraisals under en
// annan product_key än tilläggets och Tradera-ankaret missar. (Kopierad 2026-07-13.)

const CATS = {
  watches: {
    kw: ['klocka','watch','chronograph','automatic','quartz','ure'],
    br: ['rolex','omega','tudor','seiko','casio','tissot','tag heuer','breitling','hamilton','citizen','orient','festina','longines','rado','bulova','fossil','diesel','invicta','certina','oris','iwc','patek','cartier']
  },
  electronics: {
    kw: ['iphone','macbook','laptop','dator','telefon','pixel','airpods','ipad','playstation','xbox','nintendo','grafikkort','gpu','geforce','radeon','rtx','gtx','hörlurar','headphones','ps5','ps4','gpu','skärm','monitor'],
    br: ['apple','samsung','sony','lg','asus','acer','lenovo','dell','hp','google','huawei','oneplus','xiaomi','nintendo','microsoft','nikon','canon','gopro','nvidia','amd','msi','gigabyte','sapphire','zotac','evga','palit','powercolor','gainward','bose','jbl','sennheiser','garmin','pentax','logitech','dji','marshall']
  },
  clothing: {
    kw: ['jacka','jacket','skor','shoes','sneakers','byxor','hoodie','tröja','klänning','väska','bag','streetwear'],
    br: ['nike','adidas','supreme','stone island','off-white','gucci','louis vuitton','balenciaga','prada','new balance','jordan','yeezy','north face','arcteryx','canada goose','acne','our legacy']
  },
  furniture: {
    kw: ['soffa','sofa','bord','table','stol','chair','lampa','lamp','hylla','shelf','säng','bed','matta','rug','skrivbord','fåtölj','bookshelf'],
    br: ['ikea','hay','muuto','vitra','herman miller','knoll','fritz hansen','flos','artek','cappellini']
  },
  cars: {
    kw: ['suv','kombi','miltal','årsmodell','cabriolet','halvkombi','dragkrok','nybilsgaranti'],
    br: ['volvo','bmw','audi','mercedes','volkswagen','toyota','ford','honda','tesla','hyundai','kia','mazda','subaru','nissan','opel','skoda','porsche','renault','peugeot','mitsubishi','fiat','dacia','lexus']
  },
  boats: {
    kw: ['båt','segelbåt','motorbåt','roddbåt','jolle','snipa','daycruiser','styrpulpet','utombordare','inombordare','akterspegel','ruffbåt','vattenskoter','motortimmar','segeljolle'],
    br: ['yamarin','buster','quicksilver','nimbus','linder','ryds','uttern','askeladden','finnmaster','anytec','pioner','terhi','ockelbo','bayliner','draco','nidelv']
  },
  mc: {
    kw: ['motorcykel','moped','snöskoter','fyrhjuling','atv','enduro','vespa','crosshoj','mopedbil'],
    br: ['ktm','ducati','kawasaki','triumph','aprilia','husaberg','lynx','ski-doo']
  },
  bikes: {
    kw: ['cykel','elcykel','mountainbike','mtb','damcykel','herrcykel','barncykel','racercykel','hybridcykel','lådcykel'],
    br: ['crescent','monark','nishiki','bianchi','merida','skeppshult','cannondale','specialized']
  }
};

function _catFromSegment(s) {
  if (/delar|reservdel|\butrustning\b|fordonstillbehör|styling|\bsläp\b|trailer/.test(s)) return 'other';
  if (/träningsklock|aktivitetsarmband|aktivitetsband|smartwatch|smart klocka|pulsklock/.test(s)) return 'electronics';
  if (/klockor och armbandsur|\barmbandsur\b|\bklockor\b|fickur/.test(s)) return 'watches';
  if (/\bcykel\b|\bcyklar\b|elcykel/.test(s)) return 'bikes';
  if (/motorcyk|snöskoter|\batv\b|moped|scooter|scootrar|fyrhjuling|\bmc\b|mopedbil/.test(s)) return 'mc';
  if (/\bbåt\b|\bbåtar\b|vattenskoter|segelbåt|motorbåt/.test(s)) return 'boats';
  if (/husvagn|husbil/.test(s)) return 'other';
  if (/a-traktor/.test(s)) return 'cars';
  if (/\bbilar\b|transportbil|personbil|\bbil\b/.test(s)) return 'cars';
  if (/\bvitvaror\b|hushållsapparat|kyl och frys|tvättmaskin|diskmaskin|spis och ugn/.test(s)) return 'other';
  if (/elektronik|datorer|foto och video|telefoner|tv-spel|spelkonsol|ljud och bild|personvård|surfplatt|hörlur|\bkamera\b/.test(s)) return 'electronics';
  if (/barnmöbler|antika möbler|\bmöbler\b|inredning|soffor|sängar|garderob|hyllor|bord och stolar|mattor|belysning|\blampor\b/.test(s)) return 'furniture';
  if (/damkläder|herrkläder|barnkläder|gravidkläder|maskeradkläder|träningskläder|\bskor\b|barnskor|accessoar|väskor och plånböcker|smycken|solglasögon/.test(s)) return 'clothing';
  if (/djur|hundar|katter|hästar|affärsverksamhet|entreprenad|lantbruk|skogs-|jordbruk|trädgård|renovering|byggmaterial|verktyg|konst|antik|kosmetik|hud-|fritid|hobby|underhållning|jakt|fiske|camping|musik|böcker|samlarobjekt|leksaker|barnvagn|bilbarnstol|sport|golf|vintersport|vattensport/.test(s)) return 'other';
  return null;
}
function mapPageCategory(pc) {
  if (!pc) return null;
  const full = String(pc).toLowerCase();
  const segs = full.split(/\s*[>››\/|]\s*/).filter(Boolean);
  const last = segs.length ? segs[segs.length - 1] : full;
  return _catFromSegment(last) || _catFromSegment(full);
}
function _deacc(s) { return (s || '').replace(/[\u00e5\u00e4]/g, 'a').replace(/\u00f6/g, 'o').replace(/[\u00e9\u00e8]/g, 'e').replace(/\u00fc/g, 'u'); }
function _wordHit(text, term) {
  return new RegExp('(^|[^a-z0-9åäö])' + _deacc(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9åäö]|$)').test(_deacc(text));
}
const AMBIGUOUS_WATCH_BRANDS = ['diesel', 'fossil'];
function detectCategory(title, desc) {
  const text = _alias(((title||'') + ' ' + (desc||'')).toLowerCase());
  let best = 'other', bestScore = 0;
  for (const [cat, p] of Object.entries(CATS)) {
    let s = 0;
    for (const kw of p.kw) if (_wordHit(text, kw)) s += 2;
    for (const br of p.br) {
      if (!_wordHit(text, br)) continue;
      if (cat === 'watches' && AMBIGUOUS_WATCH_BRANDS.indexOf(br) !== -1 && !p.kw.some(k => _wordHit(text, k))) continue;
      s += 3;
    }
    if (s > bestScore) { bestScore = s; best = cat; }
  }
  return bestScore > 0 ? best : 'other';
}
// Capacity/memory token (VRAM/RAM/storage) grafted onto the key — value-determining for
// electronics but often past the slice(0,3) window ("RTX 5060 Ti 16GB" vs "...8GB").
// KEEP IDENTICAL across priceDB.js, supabase-tradera-ingest-function.ts, pricedb-web.js.
function _capTok(tl){ var m=(tl||'').match(/\b(\d{1,4})\s?(gb|tb)\b/); return m?(m[1]+m[2]):''; }
function _withCap(key, tl){ var c=_capTok(tl); return (c && key.indexOf(c)<0)?(key+'_'+c).slice(0,30):key; }
// MODELLNUMMER (2026-07-27, lord_dubbdäck): GPU-modellen sitter ofta efter märkesorden
// och föll utanför slice(0,3) — "Asus AMD Radeon RX 5700" blev asus_amd_radeon och blandade
// 5700 med 7900. Graftas nu på nyckeln oavsett position, precis som kapaciteten.
// MODELLVARIANT (2026-07-29). Uppmätt problem: kvalificeraren överlever bara om den råkar
// hamna inom bucketKeys slice(0,3), vilket är godtyckligt i förhållande till hur mycket den
// betyder. "PlayStation 5 Pro" blev `sony_playstation_5` — samma hink som grundmodellen —
// och "Xbox Series S" och "Xbox Series X" blev BÅDA `xbox_series`.
// Effekten i live-datan: xbox_series (n=26) hade p25 2 369 kr och p75 5 138 kr, alltså två
// produkter i en hink. Medianen 2 815 kr är fel för båda — en Series X-ägare fick sitt
// rimliga pris kallat överprissatt med ~37 %. Det är samma sorts självsäkert felaktiga dom
// som Passat-buggen, och det felläget är det produkten minst tål.
// `xl` är MEDVETET utelämnad: den är en klädstorlek och hade splittrat plaggnycklar.
// KEEP IDENTICAL across priceDB.js, supabase-tradera-ingest-function.ts, pricedb-web.js.
function _variantToks(tl){
  var ut=[];
  var x=(tl||'').match(/\bseries\s+([sx])\b/);        // Xbox Series S / X — enbokstavsvariant
  if(x) ut.push('series'+x[1]);
  var m=(tl||'').match(/\b(pro|max|plus|ultra|lite|mini)\b/g);
  if(m) for(var i=0;i<m.length;i++) ut.push(m[i]);
  return ut;
}
// Ta den första kvalificeraren som INTE redan finns i nyckeln. Utan det tappades
// "DJI Mini 3 Pro": "mini" matchade först, fanns redan i nyckeln, och "pro" nåddes aldrig.
function _withVariant(key, tl){
  var v=_variantToks(tl);
  for(var i=0;i<v.length;i++) if(key.indexOf(v[i])<0) return (key+'_'+v[i]).slice(0,30);
  return key;
}
function _modelTok(tl){ var m=(tl||'').match(/\b(?:rtx|gtx|rx|gt)\s?(\d{3,4})\b/); return m?m[1]:''; }
function _withModel(key, tl){ var c=_modelTok(tl); return (c && key.indexOf(c)<0)?(key+'_'+c).slice(0,30):key; }
// Försäljningsfraser i titeln ("Pixel 9a SÄLJES") skapade egna hinkar som aldrig delade
// prisdata med samma vara utan ordet. Tvättas bort före all annan normalisering — efter
// å/ä/ö-strippningen är "säljes" redan "sljes" och går inte att känna igen.
var SALE_WORDS = /\b(?:s[aä]ljes|s[aä]ljs|s[aä]lj|till\s+salu|salu|bortsk[aä]nkes|uthyres)\b/g;
// Redundant märkesord framför en modell som bara det märket gör ("Google Pixel" →
// "Pixel"). Utan detta hamnar samma telefon i två hinkar beroende på hur annonsen är
// skriven, och användarens skrivsätt matchar inte skördedatans.
var REDUNDANT_BRAND = /\b(?:google\s+(?=pixel\b)|apple\s+(?=(?:airpods|ipad|iphone|macbook|imac|ipod|homepod|earpods|magic)\b))/g;
var BRAND_ALIAS = [
  [/\bvw\b/g, 'volkswagen'],              // KVD skriver "vw passat", annonser "Volkswagen Passat"
  [/\bps([345])\b/g, 'sony playstation $1'],  // "PS5 Slim" och "Sony Playstation 5" ska bli samma hink
  [/\bplaystation\b/g, 'sony playstation'],
  [/\bsony\s+sony\b/g, 'sony'],           // städar dubbleringen de två reglerna ovan skapar — MÅSTE ligga sist
];
function _alias(s) { for (var i = 0; i < BRAND_ALIAS.length; i++) s = s.replace(BRAND_ALIAS[i][0], BRAND_ALIAS[i][1]); return s; }
function bucketKey(title, cat) {
  const tl = _alias(_deacc((title||'').toLowerCase().replace(SALE_WORDS, ' ').replace(REDUNDANT_BRAND, ''))).replace(/\s+/g, ' ').trim();
  if (CATS[cat]) {
    for (const br of CATS[cat].br) {
      if (_wordHit(tl, br)) {
        const words = tl.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
        const brWords = br.split(' ');
        var brIdx = -1;
        for (var wi = 0; wi <= words.length - brWords.length; wi++) {
          if (brWords.every(function(bw, j) { return words[wi + j] && words[wi + j].indexOf(bw.slice(0, 4)) === 0; })) { brIdx = wi; break; }
        }
        var brKey = br.replace(/[^a-z0-9]/g, '').slice(0, 20);
        if (brIdx >= 0) {
          var model = words.slice(brIdx + brWords.length, brIdx + brWords.length + 2).join('_');
          if (model) return _withVariant(_withModel(_withCap((brKey + '_' + model).replace(/[^a-z0-9_]/g, '').slice(0, 30), tl), tl), tl);
        }
        return _withVariant(_withModel(_withCap(brKey, tl), tl), tl);
      }
    }
  }
  var base = tl.replace(/[^\w\s]/g,'').split(/\s+/).filter(w=>w.length>2 || /\d/.test(w)).slice(0,3).join('_').slice(0,20) || 'general';
  return _withVariant(_withModel(_withCap(base, tl), tl), tl);
}
function productKey(title, desc, pageCategory) {
  const cat = mapPageCategory(pageCategory) || detectCategory(title, desc);
  return cat + ':' + bucketKey(title, cat);
}
window.PriceDBWeb = { detectCategory, mapPageCategory, bucketKey, productKey };
