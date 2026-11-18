import { collection, doc, onSnapshot, runTransaction, serverTimestamp } from "firebase/firestore";
import { db as getDb } from "./firebase";
import { Flowchart, validFlowchart } from "./flowchart";

export function subscribeFlowcharts(sessionId: string, callback: (flows: (Flowchart & { id: string })[]) => void, onError: () => void) {
  return onSnapshot(collection(getDb(), "sessions", sessionId, "flowcharts"), snap => {
    callback(snap.docs.flatMap(d => validFlowchart(d.data()) ? [{ ...d.data() as Flowchart, id: d.id }] : []));
  }, onError);
}
export async function saveFlowchart(sessionId: string, id: string, flow: Flowchart) {
  if (!validFlowchart(flow)) throw new Error("흐름도 형식이나 단계 수를 확인해 주세요.");
  const ref = doc(getDb(), "sessions", sessionId, "flowcharts", id);
  await runTransaction(getDb(), async tx => {
    const current = await tx.get(ref);
    if ((current.data()?.revision ?? 0) !== flow.revision) throw new Error("다른 창에서 수정되었습니다. 현재 내용을 확인한 뒤 최신본을 다시 열어 주세요.");
    tx.set(ref, { title: flow.title, nodes: flow.nodes, edges: flow.edges, revision: flow.revision + 1, updatedAt: serverTimestamp() });
  });
}
