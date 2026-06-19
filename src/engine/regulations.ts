export interface RegInfo {
  state: string;
  url: string;
}

// Official state fish & wildlife agency fishing-regulation pages. These are
// the authoritative sources; bayLURE links out rather than asserting limits
// itself, because creel/size/season limits vary by species, water body, and
// time of year and change frequently. Verify before keeping fish.
const STATE_REGS: Record<string, string> = {
  Alabama: 'https://www.outdooralabama.com/fishing',
  Alaska: 'https://www.adfg.alaska.gov/index.cfm?adfg=fishingSportFishingInfo.main',
  Arizona: 'https://www.azgfd.com/fishing/regulations/',
  Arkansas: 'https://www.agfc.com/fishing/',
  California: 'https://wildlife.ca.gov/Fishing',
  Colorado: 'https://cpw.state.co.us/thingstodo/Pages/Fishing.aspx',
  Connecticut: 'https://portal.ct.gov/DEEP/Fishing/Fishing',
  Delaware: 'https://dnrec.delaware.gov/fish-wildlife/fishing/',
  Florida: 'https://myfwc.com/fishing/',
  Georgia: 'https://georgiawildlife.com/fishing',
  Hawaii: 'https://dlnr.hawaii.gov/dar/fishing/fishing-regulations/',
  Idaho: 'https://idfg.idaho.gov/rules/fish',
  Illinois: 'https://dnr.illinois.gov/fishing.html',
  Indiana: 'https://www.in.gov/dnr/fish-and-wildlife/fishing/',
  Iowa: 'https://www.iowadnr.gov/Things-to-Do/Fishing',
  Kansas: 'https://ksoutdoors.com/Fishing',
  Kentucky: 'https://fw.ky.gov/Fish/Pages/default.aspx',
  Louisiana: 'https://www.wlf.louisiana.gov/page/fishing',
  Maine: 'https://www.maine.gov/ifw/fishing-boating/fishing/',
  Maryland: 'https://dnr.maryland.gov/fisheries/Pages/regulations/index.aspx',
  Massachusetts: 'https://www.mass.gov/fishing',
  Michigan: 'https://www.michigan.gov/dnr/things-to-do/fishing',
  Minnesota: 'https://www.dnr.state.mn.us/fishing/index.html',
  Mississippi: 'https://www.mdwfp.com/fishing-boating/',
  Missouri: 'https://mdc.mo.gov/fishing',
  Montana: 'https://fwp.mt.gov/fish',
  Nebraska: 'https://outdoornebraska.gov/fishing/',
  Nevada: 'https://www.ndow.org/species/fish/',
  'New Hampshire': 'https://www.wildlife.nh.gov/fishing',
  'New Jersey': 'https://dep.nj.gov/njfw/fishing/',
  'New Mexico': 'https://www.wildlife.state.nm.us/fishing/',
  'New York': 'https://dec.ny.gov/things-to-do/fishing',
  'North Carolina': 'https://www.ncwildlife.org/fishing',
  'North Dakota': 'https://gf.nd.gov/fishing',
  Ohio: 'https://ohiodnr.gov/discover-and-learn/safety-conservation/about-ODNR/wildlife/fishing',
  Oklahoma: 'https://www.wildlifedepartment.com/fishing',
  Oregon: 'https://myodfw.com/fishing',
  Pennsylvania: 'https://www.fishandboat.com/',
  'Rhode Island': 'https://dem.ri.gov/natural-resources-bureau/fish-and-wildlife/recreational-fishing',
  'South Carolina': 'https://www.dnr.sc.gov/fishing.html',
  'South Dakota': 'https://gfp.sd.gov/fishing/',
  Tennessee: 'https://www.tn.gov/twra/fishing.html',
  Texas: 'https://tpwd.texas.gov/regulations/outdoor-annual/fishing',
  Utah: 'https://wildlife.utah.gov/fishing-in-utah.html',
  Vermont: 'https://vtfishandwildlife.com/fish',
  Virginia: 'https://dwr.virginia.gov/fishing/',
  Washington: 'https://wdfw.wa.gov/fishing',
  'West Virginia': 'https://wvdnr.gov/fishing/',
  Wisconsin: 'https://dnr.wisconsin.gov/topic/fishing',
  Wyoming: 'https://wgfd.wyo.gov/fishing',
  'District of Columbia': 'https://doee.dc.gov/service/fishing-dc',
};

/** Official regulations link for a US state, or null if unmapped. */
export function regulationsForState(state: string | undefined): RegInfo | null {
  if (!state) return null;
  const url = STATE_REGS[state];
  return url ? { state, url } : null;
}
