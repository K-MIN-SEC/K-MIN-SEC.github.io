type Profile = Record<string, any>;
export function profileSummary(profile: Profile | null) {
  const p = profile || {};
  const labels: Record<string, string> = {available:'프로젝트 참여 가능',limited:'프로젝트 참여 조건 협의',unavailable:'현재 프로젝트 참여 어려움'};
  return {availability:labels[p.availability] || '', availabilityState:labels[p.availability]?p.availability:'hidden', role:p.primary_role||'', affiliation:p.affiliation_type===undefined?[p.school_name,p.department_name].filter(Boolean).join(' · '):p.affiliation_type==='none'?'':[p.affiliation_name,p.affiliation_unit].filter(Boolean).join(' · '), interests:Array.isArray(p.interests)?p.interests.map(String):[], tools:Array.isArray(p.tools)?p.tools.map(String):[]};
}
