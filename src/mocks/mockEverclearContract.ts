export const mockEverclearContract = {
    fillInvoice: async (invoice: any, privateKey: string) => {
      console.log(`Mocking fill invoice: ${invoice.intent_id}`);
      // In a real implementation, this would interact with the Everclear contract
      // and perform the actual fill transaction
      return true;
    }
  };