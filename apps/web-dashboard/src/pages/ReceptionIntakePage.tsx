import { ReceptionInstructionsSection } from './ReceptionsPage';
import { SellerStockSection } from './SellerStockPage';

/** Customer's nav spec bundles reception instructions and seller stock photos under one "Reception & Intake" item. */
export function ReceptionIntakePage() {
  return (
    <div>
      <h1>Reception & Intake</h1>
      <p className="page-subtitle">Incoming deliveries, reception instructions, and seller stock photos.</p>
      <ReceptionInstructionsSection />
      <div style={{ marginTop: 32 }}>
        <SellerStockSection />
      </div>
    </div>
  );
}
