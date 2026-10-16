export function signalColor(type: string) {
  if (/power|mains|iec|240v|120v/i.test(type)) return "#c44747";
  if (/fiber|fibre|optical/i.test(type)) return "#b56a19";
  if (/audio|xlr|dante|speaker/i.test(type)) return "#a347a1";
  if (/hdmi|displayport|sdi|video/i.test(type)) return "#536bce";
  if (/rj45|cat[5678]|ethernet|network/i.test(type)) return "#278078";
  return "#536779";
}
