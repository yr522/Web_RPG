import { newSave } from '../shared/sim/save';
import { pickTalk, npcMark } from '../shared/rules/story';
import { questTarget, npcPlace } from '../shared/rules/quests';
import { QUESTS } from '../shared/data/quests';
const s = newSave('a', 'warrior', 'M');
s.quests = { tu1: { active: false, counts: [], done: true }, tu2: { active: false, counts: [], done: true } } as never;
console.log(pickTalk(s, 'leon')?.talk, npcMark(s, 'leon'));
console.log(npcPlace('kyla', s));
