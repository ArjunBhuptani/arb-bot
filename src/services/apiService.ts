import axios from 'axios';
import { Invoice } from '../types';
import { logger } from '../utils/logger';

export async function fetchOldInvoices(apiUrl: string): Promise<Invoice[]> {
  try {
    const response = await axios.get(apiUrl);
    const data = response.data;

    const oldInvoices = data.invoices.filter((invoice: Invoice) => {
      return isOlderThanSixHours(invoice.hub_invoice_enqueued_timestamp);
    });

    return oldInvoices;
  } catch (error) {
    logger.error('Error fetching invoices:', error);
    throw error;
  }
}

function isOlderThanSixHours(timestamp: string): boolean {
  const sixHoursInMilliseconds = 6 * 60 * 60 * 1000;
  const invoiceTime = new Date(parseInt(timestamp)).getTime();
  const currentTime = Date.now();
  return (currentTime - invoiceTime) > sixHoursInMilliseconds;
}