type Profile = Record<string, any>;
export function profileSummary(profile: Profile | null) {
  const p = profile || {};
  const years = [p.admission_year && `${p.admission_year}년 입학`, p.graduation_year ? `${p.graduation_year}년 졸업` : p.expected_graduation_year && `${p.expected_graduation_year}년 졸업 예정`].filter(Boolean).join(' · ');
  const availability: Record<string, string> = {available:'참여 가능',limited:'조건부 가능',unavailable:'현재 참여 어려움'};
  return {years, availability:availability[p.availability] || '', interests:Array.isArray(p.interests)?p.interests.map(String):[], tools:Array.isArray(p.tools)?p.tools.map(String):[]};
}
