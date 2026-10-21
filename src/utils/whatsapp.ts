import { Linking, Alert } from 'react-native';

export const MESSAGE_TEMPLATES = {
  LEAD_CREATED:
    'Thank you for visiting Parth Mobile Care. We are waiting for your next visit.',
  PURCHASE_COMPLETED:
    'Thank you for shopping with Parth Mobile Care. We hope to serve you again.',
  FOLLOW_UP_REMINDER: (product: string) =>
    `Hello! Checking in from Parth Mobile Care regarding your inquiry about ${product}. We have exciting offers available today!`,
  SALES_RECEIPT: (buyerName: string, model: string, amount: string, invoiceNo: string) =>
    `Dear ${buyerName},\nThank you for purchasing ${model} (${amount}) from Parth Mobile Care.\nInvoice #: ${invoiceNo}\nWe hope to serve you again!`,
};

/**
 * Open WhatsApp with pre-filled message
 * Strips non-numeric characters from phone and ensures country code (default 91 for India)
 */
export async function sendWhatsAppMessage(
  phone: string,
  message: string
): Promise<boolean> {
  try {
    let cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = `91${cleanPhone}`;
    }
    const encodedMessage = encodeURIComponent(message);
    const url = `whatsapp://send?phone=${cleanPhone}&text=${encodedMessage}`;
    const webUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
      return true;
    } else {
      // Fallback to web link
      await Linking.openURL(webUrl);
      return true;
    }
  } catch (error) {
    Alert.alert('WhatsApp Error', 'Could not open WhatsApp. Please check if WhatsApp is installed.');
    return false;
  }
}

/**
 * Open native SMS app with recipient and pre-filled body
 */
export async function sendSmsMessage(
  phone: string,
  message: string
): Promise<boolean> {
  try {
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    const encodedMessage = encodeURIComponent(message);
    const url = `sms:${cleanPhone}?body=${encodedMessage}`;
    await Linking.openURL(url);
    return true;
  } catch (error) {
    Alert.alert('SMS Error', 'Could not open messaging app.');
    return false;
  }
}

/**
 * Direct phone dialer
 */
export async function makePhoneCall(phone: string): Promise<boolean> {
  try {
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    const url = `tel:${cleanPhone}`;
    await Linking.openURL(url);
    return true;
  } catch (error) {
    Alert.alert('Call Error', 'Could not open dialer.');
    return false;
  }
}
