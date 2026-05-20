import { getDatabase } from "@uns-kit/database";

export async function loadOrders(lineId: string, orderIds: string[]) {
  const db = await getDatabase("mainPg");

  return db.query(
    "select * from orders where line_id = :lineId and order_id in (:orderIds)",
    { lineId, orderIds }
  );
}
