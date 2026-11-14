import { DeliveriesSection } from './ReceptionsPage';
import { SellerStockSection } from './SellerStockPage';

/** Customer's nav spec bundles all received stuff — deliveries and seller stock pallets — under one "Reception & Intake" item, as two separate tables (different record shapes, see each section's own doc comment). */
export function ReceptionIntakePage() {
  return (
    <div>
      <h1>Reception & Intake</h1>
      <p className="page-subtitle">Every delivery and seller stock pallet received, with full details and photos.</p>
      <DeliveriesSection />
      <div style={{ marginTop: 32 }}>
        <SellerStockSection />
      </div>
    </div>
  );
}
