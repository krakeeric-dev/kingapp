export type CompanyCallRoute = {
  companyId: string;
  companyName: string;
  inboundNumber: string;
  department: string;
  defaultQueue: string;
};

export const companyCallRoutes: CompanyCallRoute[] = [
  {
    companyId: "COMP-AGAHOZO",
    companyName: "Agahozo Water",
    inboundNumber: "+250788000100",
    department: "Sales",
    defaultQueue: "Agahozo Sales Queue"
  },
  {
    companyId: "COMP-TEJU",
    companyName: "Teju Juice",
    inboundNumber: "+250788000200",
    department: "Sales",
    defaultQueue: "Teju Juice Queue"
  },
  {
    companyId: "COMP-KING-HONEY",
    companyName: "King Honey",
    inboundNumber: "+250788000300",
    department: "Customer Care",
    defaultQueue: "King Honey Queue"
  },
  {
    companyId: "COMP-KING-EGGS",
    companyName: "King Eggs",
    inboundNumber: "+250788000400",
    department: "Orders",
    defaultQueue: "King Eggs Queue"
  }
];

function normalizePhone(phone?: string) {
  return (phone ?? "").replace(/\D/g, "");
}

export function routeCallByInboundNumber(toNumber?: string) {
  const normalizedTo = normalizePhone(toNumber);
  return (
    companyCallRoutes.find((route) => normalizePhone(route.inboundNumber) === normalizedTo) ??
    null
  );
}

export function getUnknownCompanyCallLabel() {
  return "Unknown Company Call";
}
