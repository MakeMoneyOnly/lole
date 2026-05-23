/**
 * MED-007: Translation Coverage with Fallback System
 *
 * Provides comprehensive translation support for:
 * - English (en) - Primary language
 * - Amharic (am) - Ethiopian local language
 *
 * Features:
 * - Fallback to English for missing translations
 * - Type-safe translation keys
 * - Interpolation support for dynamic values
 * - Pluralization support
 */

import { AppLocale, DEFAULT_APP_LOCALE } from './locale';
import { logger } from '../logger';

// ============================================
// TRANSLATION TYPES
// ============================================

/**
 * Translation key paths (nested object paths)
 */
type _TranslationKeys = typeof translations.en;

/**
 * Deep partial type for incomplete translations
 */
type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// ============================================
// COMMON TRANSLATIONS
// ============================================

const commonTranslations = {
    // Navigation
    nav: {
        home: 'Home',
        menu: 'Menu',
        orders: 'Orders',
        tables: 'Tables',
        kds: 'Kitchen Display',
        settings: 'Settings',
        staff: 'Staff',
        reports: 'Reports',
        analytics: 'Analytics',
    },
    // Actions
    actions: {
        save: 'Save',
        cancel: 'Cancel',
        delete: 'Delete',
        edit: 'Edit',
        add: 'Add',
        update: 'Update',
        create: 'Create',
        search: 'Search',
        filter: 'Filter',
        export: 'Export',
        import: 'Import',
        refresh: 'Refresh',
        close: 'Close',
        confirm: 'Confirm',
        back: 'Back',
        next: 'Next',
        submit: 'Submit',
        reset: 'Reset',
        clear: 'Clear',
        view: 'View',
        print: 'Print',
        download: 'Download',
    },
    // Status
    status: {
        pending: 'Pending',
        confirmed: 'Confirmed',
        preparing: 'Preparing',
        ready: 'Ready',
        completed: 'Completed',
        cancelled: 'Cancelled',
        delivered: 'Delivered',
        active: 'Active',
        inactive: 'Inactive',
        enabled: 'Enabled',
        disabled: 'Disabled',
        online: 'Online',
        offline: 'Offline',
        error: 'Error',
        success: 'Success',
        loading: 'Loading...',
    },
    // Time
    time: {
        now: 'Now',
        today: 'Today',
        yesterday: 'Yesterday',
        tomorrow: 'Tomorrow',
        thisWeek: 'This Week',
        thisMonth: 'This Month',
        lastMonth: 'Last Month',
        thisYear: 'This Year',
        allTime: 'All Time',
        minutes: 'minutes',
        hours: 'hours',
        days: 'days',
        weeks: 'weeks',
        months: 'months',
        years: 'years',
    },
    // Currency
    currency: {
        etb: 'ETB',
        birr: 'Birr',
        total: 'Total',
        subtotal: 'Subtotal',
        tax: 'Tax',
        discount: 'Discount',
        tip: 'Tip',
        amount: 'Amount',
        balance: 'Balance',
        paid: 'Paid',
        unpaid: 'Unpaid',
        refund: 'Refund',
    },
    // Validation
    validation: {
        required: 'This field is required',
        invalidEmail: 'Please enter a valid email address',
        invalidPhone: 'Please enter a valid phone number',
        minLength: 'Must be at least {min} characters',
        maxLength: 'Must be no more than {max} characters',
        minValue: 'Must be at least {min}',
        maxValue: 'Must be no more than {max}',
        passwordMismatch: 'Passwords do not match',
        invalidNumber: 'Please enter a valid number',
    },
    // Errors
    errors: {
        generic: 'An error occurred. Please try again.',
        notFound: 'Not found',
        unauthorized: 'Unauthorized access',
        forbidden: 'Access denied',
        serverError: 'Server error. Please try again later.',
        networkError: 'Network error. Please check your connection.',
        sessionExpired: 'Your session has expired. Please log in again.',
        validationError: 'Please check your input and try again.',
    },
    // Success messages
    success: {
        saved: 'Successfully saved',
        updated: 'Successfully updated',
        deleted: 'Successfully deleted',
        created: 'Successfully created',
        sent: 'Successfully sent',
        copied: 'Copied to clipboard',
    },
    // Confirmation
    confirm: {
        delete: 'Are you sure you want to delete this item?',
        cancel: 'Are you sure you want to cancel?',
        unsavedChanges: 'You have unsaved changes. Are you sure you want to leave?',
    },
};

// ============================================
// ENGLISH TRANSLATIONS (Complete)
// ============================================

const enTranslations = {
    ...commonTranslations,
    // Orders
    orders: {
        title: 'Orders',
        newOrder: 'New Order',
        orderNumber: 'Order #{number}',
        orderType: {
            dineIn: 'Dine In',
            delivery: 'Delivery',
            pickup: 'Pickup',
        },
        items: 'Items',
        quantity: 'Quantity',
        price: 'Price',
        notes: 'Notes',
        specialRequests: 'Special Requests',
        noOrders: 'No orders found',
        activeOrders: 'Active Orders',
        orderHistory: 'Order History',
        placeOrder: 'Place Order',
        modifyOrder: 'Modify Order',
        cancelOrder: 'Cancel Order',
        refundOrder: 'Refund Order',
        printReceipt: 'Print Receipt',
        estimatedTime: 'Est. {time} min',
    },
    // Menu
    menu: {
        title: 'Menu',
        categories: 'Categories',
        allItems: 'All Items',
        popular: 'Popular',
        newItem: 'New Item',
        editItem: 'Edit Item',
        deleteItem: 'Delete Item',
        itemName: 'Item Name',
        description: 'Description',
        price: 'Price',
        image: 'Image',
        available: 'Available',
        unavailable: 'Unavailable',
        outOfStock: 'Out of Stock',
        dietaryInfo: 'Dietary Information',
        vegetarian: 'Vegetarian',
        vegan: 'Vegan',
        glutenFree: 'Gluten Free',
        spicy: 'Spicy',
        modifiers: 'Modifiers',
        addModifier: 'Add Modifier',
        options: 'Options',
        required: 'Required',
        optional: 'Optional',
    },
    // Tables
    tables: {
        title: 'Tables',
        tableNumber: 'Table {number}',
        capacity: 'Capacity: {count} guests',
        occupied: 'Occupied',
        available: 'Available',
        reserved: 'Reserved',
        cleaning: 'Cleaning',
        currentOrder: 'Current Order',
        startOrder: 'Start Order',
        transferTable: 'Transfer Table',
        mergeTables: 'Merge Tables',
        splitTable: 'Split Table',
        noTables: 'No tables configured',
    },
    // KDS (Kitchen Display System)
    kds: {
        title: 'Kitchen Display',
        incoming: 'Incoming',
        preparing: 'Preparing',
        ready: 'Ready',
        completed: 'Completed',
        bumped: 'Bumped',
        orderReady: 'Order Ready',
        startPreparing: 'Start Preparing',
        markReady: 'Mark Ready',
        markCompleted: 'Mark Completed',
        recall: 'Recall',
        rush: 'RUSH',
        fireAll: 'Fire All',
        course: 'Course {number}',
        expedite: 'Expedite',
        averageTime: 'Avg. Time: {time} min',
        ordersInQueue: '{count} orders in queue',
    },
    // Payments
    payments: {
        title: 'Payments',
        method: 'Payment Method',
        cash: 'Cash',
        card: 'Card',
        mobileMoney: 'Mobile Money',
        telebirr: 'Telebirr',
        chapa: 'Chapa',
        split: 'Split Payment',
        addTip: 'Add Tip',
        noPayment: 'No payment required',
        processPayment: 'Process Payment',
        paymentComplete: 'Payment Complete',
        paymentFailed: 'Payment Failed',
        refund: 'Refund',
        partialRefund: 'Partial Refund',
    },
    // Staff
    staff: {
        title: 'Staff',
        addStaff: 'Add Staff Member',
        editStaff: 'Edit Staff Member',
        name: 'Name',
        email: 'Email',
        phone: 'Phone',
        role: 'Role',
        roles: {
            admin: 'Admin',
            manager: 'Manager',
            waiter: 'Waiter',
            chef: 'Chef',
            cashier: 'Cashier',
        },
        status: 'Status',
        clockIn: 'Clock In',
        clockOut: 'Clock Out',
        onBreak: 'On Break',
        shiftHours: 'Shift Hours',
        pin: 'PIN',
        setPin: 'Set PIN',
        changePin: 'Change PIN',
    },
    // Guests
    guests: {
        title: 'Guests',
        guestInfo: 'Guest Information',
        name: 'Name',
        phone: 'Phone',
        email: 'Email',
        visits: 'Visits',
        totalSpent: 'Total Spent',
        lastVisit: 'Last Visit',
        notes: 'Notes',
        allergies: 'Allergies',
        preferences: 'Preferences',
        addGuest: 'Add Guest',
        editGuest: 'Edit Guest',
        guestHistory: 'Guest History',
    },
    // Settings
    settings: {
        title: 'Settings',
        general: 'General',
        restaurant: 'Restaurant',
        profile: 'Profile',
        notifications: 'Notifications',
        integrations: 'Integrations',
        billing: 'Billing',
        language: 'Language',
        theme: 'Theme',
        darkMode: 'Dark Mode',
        lightMode: 'Light Mode',
        currency: 'Currency',
        timezone: 'Timezone',
        taxRate: 'Tax Rate',
        serviceCharge: 'Service Charge',
    },
    // Reports
    reports: {
        title: 'Reports',
        sales: 'Sales Report',
        orders: 'Order Report',
        items: 'Item Report',
        staff: 'Staff Report',
        payments: 'Payment Report',
        exportPdf: 'Export PDF',
        exportExcel: 'Export Excel',
        dateRange: 'Date Range',
        compare: 'Compare',
        totalSales: 'Total Sales',
        totalOrders: 'Total Orders',
        averageOrder: 'Average Order Value',
        topItems: 'Top Items',
        topCategories: 'Top Categories',
    },
    // Offline
    offline: {
        title: 'You are offline',
        message: 'Some features may be limited. Your data will sync when connection is restored.',
        pendingSync: '{count} items pending sync',
        syncComplete: 'All data synced',
        syncFailed: 'Sync failed. Will retry automatically.',
        slowNetwork: 'Slow network connection detected. Some features may load slower.',
    },
};

// ============================================
// AMHARIC TRANSLATIONS (Partial - with fallback)
// ============================================

const amTranslations: DeepPartial<typeof enTranslations> = {
    nav: {
        home: 'ቤት',
        menu: 'ምናሌ',
        orders: 'ትዕዛዞች',
        tables: 'ጠረጴዛዎች',
        kds: 'የኩሽና ማሳያ',
        settings: 'ቅንብሮች',
        staff: 'ሰራተኞች',
        reports: 'ሪፖርቶች',
        analytics: 'ማስታወሻዎች',
    },
    actions: {
        save: 'አስቀምጥ',
        cancel: 'ሰርዝ',
        delete: 'ሰርዝ',
        edit: 'አርትዕ',
        add: 'አክል',
        update: 'አዘምን',
        create: 'ፍጠር',
        search: 'ፈልግ',
        filter: 'አጣራ',
        export: 'ላክ ውጭ',
        import: 'አስገባ',
        refresh: 'አድስ',
        close: 'ዝጋ',
        confirm: 'አረጋግጥ',
        back: 'ተመለስ',
        next: 'ቀጣይ',
        submit: 'አስገባ',
        reset: 'ዳግም አስጀምር',
        clear: 'አጽዳ',
        view: 'ተመልከት',
        print: 'አትም',
        download: 'አውርድ',
    },
    status: {
        pending: 'በመጠባበቅ ላይ',
        confirmed: 'የተረጋገጠ',
        preparing: 'በማዘጋጀት ላይ',
        ready: 'ዝግጁ',
        completed: 'ተጠናቋል',
        cancelled: 'ተሰርዟል',
        delivered: 'ተላከ',
        active: 'ንቁ',
        inactive: 'ንቁ ያልሆነ',
        enabled: 'ነቅቷል',
        disabled: 'ተሰናክሏል',
        online: 'መስመር ላይ',
        offline: 'ከመስመር ውጭ',
        error: 'ስህተት',
        success: 'ተሳክቷል',
        loading: 'በመጫን ላይ...',
    },
    currency: {
        etb: 'ብር',
        birr: 'ብር',
        total: 'ጠቅላላ',
        subtotal: 'ንዑስ ድርድር',
        tax: 'ግብር',
        discount: 'ቅናሽ',
        amount: 'መጠን',
        tip: 'ጁስ',
        paid: 'የተከፈለ',
        unpaid: 'ያልተከፈለ',
        refund: 'ርዝመት',
        balance: 'ቀሪ ሂሳብ',
    },
    errors: {
        generic: 'ስህተት ተከስቷል። እባክዎ እንደገና ይሞክሩ።',
        notFound: 'አልተገኘም',
        unauthorized: 'ያልተፈቀደ መዳረሻ',
        forbidden: 'መዳረሻ ተከልክሏል',
        serverError: 'የአጋርተር ስህተት። እባክዎ ቆይተው ይሞክሩ።',
        networkError: 'የአውታረ መረብ ስህተት። እባክዎ ግንኙነትዎን ያረጋግጡ።',
        sessionExpired: 'ክፍለ ጊዝዎ አብቅቷል። እባክዎ እንደገና ይግቡ።',
        validationError: 'እባክዎ ማስገቢያዎን ያረጋግጡ እና እንደገና ይሞክሩ።',
    },
    time: {
        now: 'አሁን',
        today: 'ዛሬ',
        yesterday: 'ትናንት',
        tomorrow: 'ነገ',
        thisWeek: 'ይህ ሳምንት',
        thisMonth: 'ይህ ወር',
        lastMonth: 'ካለፈው ወር',
        thisYear: 'ይህ ዓመት',
        allTime: 'ሁሉም ጊዜ',
        minutes: 'ደቂቃዎች',
        hours: 'ሰዓታት',
        days: 'ቀናት',
        weeks: 'ሳምንታት',
        months: 'ወራት',
        years: 'ዓመታት',
    },
    validation: {
        required: 'ይህ መስክ ያስፈላጊ ነው',
        invalidEmail: 'እባክዎ ትክክለኛ ኢሜይል ያስገቡ',
        invalidPhone: 'እባክዎ ትክክለኛ ስልክ ቁጥር ያስገቡ',
        minLength: 'ቢያንስ {min} ቁምፊዎች መሆን አለበት',
        maxLength: 'ከ{max} ቁምፊዎች መብለጥ የለበትም',
        minValue: 'ቢያንስ {min} መሆን አለበት',
        maxValue: 'ከ{max} መብለጥ የለበትም',
        passwordMismatch: 'የይለፍ ቃሎች አይዛዙም',
        invalidNumber: 'እባክዎ ትክክለኛ ቁጥር ያስገቡ',
    },
    confirm: {
        delete: 'እርግጠኛ ኖት ይህንን አስወግድ?',
        cancel: 'እርግጠኛ ኖት መሰረዝ ይፈልጋሉ?',
        unsavedChanges: 'ያልተቀመጡ ለውጦች አሉዎት። እርግጠኛ ኖት ለመውጣት?',
    },
    orders: {
        title: 'ትዕዛዞች',
        newOrder: 'አዲስ ትዕዛዝ',
        orderNumber: 'ትዕዛዝ #{number}',
        orderType: {
            dineIn: 'በቤት ውስጥ',
            delivery: 'ዴሊቨሪ',
            pickup: 'ለመውሰድ',
        },
        items: 'እቃዎች',
        quantity: 'ብዛት',
        price: 'ዋጋ',
        notes: 'ማስታወሻዎች',
        specialRequests: 'ልዩ ጥዕና',
        noOrders: 'ምንም ትዕዛዞች የሉም',
        activeOrders: 'ንቁ ትዕዛዞች',
        orderHistory: 'የትዕዛዝ ታሪክ',
        placeOrder: 'ትዕዛዝ አስገባ',
        modifyOrder: 'ትዕዛዝ አርትዕ',
        cancelOrder: 'ትዕዛዝ ሰርዝ',
        refundOrder: 'ትዕዛዝ ርዝመት',
        printReceipt: 'ደረጃ አትም',
        estimatedTime: 'ዕ. ጊ. {time} ደቂቃ',
    },
    menu: {
        title: 'ምናሌ',
        categories: 'ምድቦች',
        allItems: 'ሁሉም እቃዎች',
        popular: 'ተወዳጅ',
        newItem: 'አዲስ እቃ',
        editItem: 'እቃ አርትዕ',
        deleteItem: 'እቃ ሰርዝ',
        itemName: 'የእቃ ስም',
        description: 'መግለጫ',
        price: 'ዋጋ',
        image: 'ምስል',
        available: 'ያለ',
        unavailable: 'የለም',
        outOfStock: 'ጨርሷል',
        dietaryInfo: 'የአካል መረጃ',
        vegetarian: 'የቀይ ስር የሌለው',
        vegan: 'ቤጋን',
        glutenFree: 'የግልቲን የሌለው',
        spicy: 'በፈሳም',
        modifiers: 'ማስተካከያዎች',
        addModifier: 'ማስተካከያ አክል',
        options: 'አማማጪዎች',
        required: 'የሚያወስድ',
        optional: 'ፀိုပ်ထားနိုင်',
    },
    tables: {
        title: 'ጠረጴዛዎች',
        tableNumber: 'ጠረጴዛ {number}',
        capacity: 'መጠን፡ {count} እንግዶች',
        occupied: 'የተያዘ',
        available: 'ባዶ',
        reserved: 'የተያዘ',
        cleaning: 'በደረጃ ማጠቃ',
        currentOrder: 'የአሁን ትዕዛዝ',
        startOrder: 'ትዕዛዝ ጀምር',
        transferTable: 'ጠረጴዛ ለእስከ',
        mergeTables: 'ጠረጴዛዎችን አዋረድ',
        splitTable: 'ጠረጴዛ አሥር',
        noTables: 'ምንም ጠረጴዛዎች አልተዘጋበትም',
    },
    kds: {
        title: 'የኩሽና ማሳያ',
        incoming: 'በመምጣት ላይ',
        preparing: 'በማዘጋጀት ላይ',
        ready: 'ዝግጁ',
        completed: 'ተጠናቋል',
        bumped: 'ተቋጥረ',
        orderReady: 'ትዕዛዝ ዝግጁ',
        startPreparing: 'ማዘጋጀት ጀምር',
        markReady: 'ዝግጁ ምልክት አድርግ',
        markCompleted: 'ተጠናቋል ምልክት አድርግ',
        recall: 'ከልከፍ',
        rush: 'በጣም በጣም',
        fireAll: 'ሁሉንም አፍልግ',
        course: 'ክፍል {number}',
        expedite: 'ፈጣን አድርግ',
        averageTime: 'አማካይ ጊዜ፡ {time} ደቂቃ',
        ordersInQueue: '{count} ትዕዛዞች በዕቅድ ውስጥ',
    },
    payments: {
        title: 'ክፍያዎች',
        method: 'የክፍያ ዘዴ',
        cash: 'ጥሬ ገንዘብ',
        card: 'ካርድ',
        mobileMoney: 'ሞባይል ገንዘብ',
        telebirr: 'ቴሌብር',
        chapa: 'ቻፓ',
        split: 'ክፍያ አለበረታ',
        addTip: 'ጊዜ አክል',
        noPayment: 'ክፍያ አይያወስድ',
        processPayment: 'ክፍያ አስገባ',
        paymentComplete: 'ክፍያ ተጠናቋል',
        paymentFailed: 'ክፍያ አልተሳካም',
        refund: 'ርዝመት',
        partialRefund: 'ከፍተኛ ርዝመት',
    },
    staff: {
        title: 'ሰራተኞች',
        addStaff: 'ሰራተኛ አክል',
        editStaff: 'ሰራተኛ አርትዕ',
        name: 'ስም',
        email: 'ኢሜይል',
        phone: 'ስልክ',
        role: 'ሚና',
        roles: {
            admin: 'አስተዳዳሪ',
            manager: 'ሥራ አስኪያጅ',
            waiter: 'አገልጋይ',
            chef: 'ሼፍ',
            cashier: 'ገንዘብ ተቆጣጣሪ',
        },
        status: 'ሁኔታ',
        clockIn: 'ጊዜ ጀምር',
        clockOut: 'ጊዜ አቁም',
        onBreak: 'በአውድ ላይ',
        shiftHours: 'የምእት ሰዓታት',
        pin: 'ፒን',
        setPin: 'ፒን አስገባ',
        changePin: 'ፒን ወይም',
    },
    guests: {
        title: 'እንግዶች',
        guestInfo: 'የእንግድ መረጃ',
        name: 'ስም',
        phone: 'ስልክ',
        email: 'ኢሜይል',
        visits: 'ጉብኝቶች',
        totalSpent: 'ጠቅላላ የገኙት',
        lastVisit: 'መጨረሻ ጉብኝት',
        notes: 'ማስታወሻዎች',
        allergies: 'መረመሮች',
        preferences: 'ምርጥ አማማጪዎች',
        addGuest: 'እንግድ አክል',
        editGuest: 'እንግድ አርትዕ',
        guestHistory: 'የእንግድ ታሪክ',
    },
    settings: {
        title: 'ቅንብሮች',
        general: 'አጠቃላይ',
        restaurant: 'ምግብ ቤေቕ',
        profile: 'መጠን ማህደክ',
        notifications: 'ማስታዎች',
        integrations: 'የዕውቀት መካን',
        billing: 'የሂደት',
        language: 'ቋንቋ',
        theme: 'ገጽታ',
        darkMode: 'ጨለማ ሁነታ',
        lightMode: 'ብርሃን ሁነታ',
        currency: 'የገንዘብ ምንዛሪ',
        timezone: 'የጊዜ ክልል',
        taxRate: 'የግብር መጠን',
        serviceCharge: 'የአገልግሎት ክፍያ',
    },
    offline: {
        title: 'ከመስመር ውጭ ነዎት',
        message: 'አንዳንድ ባህሪያት የተገደቡ ሊሆኑ ይችላሉ። ግንኙነት ሲመለስ ውሂብዎ ይመሳሰላል።',
        pendingSync: '{count} እቃዎች በመላክ ላይ',
        syncComplete: 'ሁሉም ውሂብ ተመሳስሏል',
        syncFailed: 'ማመሳሰል አልተሳካም። በራስ-ሰር ይሞክራል።',
        slowNetwork: 'የአውታረ መረብ ግንዛቢ ደብተሎች ተገኙ። አንዳንድ ባህሪያት የተቀናጀ ሊደርሱ ይችላሉ።',
    },
    reports: {
        title: 'ሪፖርቶች',
        sales: 'የሽያጭ ሪፖርት',
        orders: 'የትዕዛዝ ሪፖርት',
        items: 'የእቃ ሪፖርት',
        staff: 'የሰራተኛ ሪፖርት',
        payments: 'የክፍያ ሪፖርት',
        exportPdf: 'PDF ላክ ውጭ',
        exportExcel: 'Excel ላክ ውጭ',
        dateRange: 'የቀን ክልል',
        compare: 'አወዳድር',
        totalSales: 'ጠቅላላ ሽያጭ',
        totalOrders: 'ጠቅላላ ትዕዛዞች',
        averageOrder: 'አማካይ የትዕዛዝ ዋጋ',
        topItems: 'ከፍተኛ እቃዎች',
        topCategories: 'ከፍተኛ ምድቦች',
    },
    success: {
        saved: 'በተሳካ ሁኔታ ተቀምጧል',
        updated: 'በተሳካ ሁኔታ ዘምኗል',
        deleted: 'በተሳካ ሁኔታ ተሰርዟል',
        created: 'በተሳካ ሁኔታ ተፈጥሯል',
        sent: 'በተሳካ ሁኔታ ተላከ',
        copied: 'ወደ ቅንጥብ ሰሌዳ ተቀድቷል',
    },
};

// ============================================
// TRANSLATION OBJECT
// ============================================

export const translations = {
    en: enTranslations,
    am: amTranslations as typeof enTranslations,
} as const;

// ============================================
// TRANSLATION FUNCTIONS
// ============================================

/**
 * Get a nested value from an object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
    const keys = path.split('.');
    let current: unknown = obj;

    for (const key of keys) {
        if (current && typeof current === 'object' && key in current) {
            current = (current as Record<string, unknown>)[key];
        } else {
            return undefined;
        }
    }

    return typeof current === 'string' ? current : undefined;
}

/**
 * Interpolate values into a translation string
 * Example: "Hello {name}" with { name: "World" } => "Hello World"
 */
function interpolate(template: string, values: Record<string, string | number>): string {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
        return values[key]?.toString() ?? match;
    });
}

/**
 * Get a translation with fallback to English
 */
export function t(
    key: string,
    locale: AppLocale = DEFAULT_APP_LOCALE,
    values?: Record<string, string | number>
): string {
    // Try to get translation in requested locale
    let translation = getNestedValue(
        translations[locale] as unknown as Record<string, unknown>,
        key
    );

    // Fallback to English if not found
    if (!translation && locale !== 'en') {
        translation = getNestedValue(translations.en as unknown as Record<string, unknown>, key);
    }

    // Return key if no translation found
    if (!translation) {
        logger.warn(`[i18n] Missing translation for key: ${key}`);
        return key;
    }

    // Interpolate values if provided
    if (values) {
        return interpolate(translation, values);
    }

    return translation;
}

/**
 * Get all translations for a locale (with fallback to English for missing keys)
 */
export function getTranslations(locale: AppLocale = DEFAULT_APP_LOCALE): typeof translations.en {
    if (locale === 'en') {
        return translations.en;
    }

    // For other locales, merge with English as fallback
    return {
        ...translations.en,
        ...(translations[locale] as typeof translations.en),
    };
}

/**
 * Check if a translation exists for a key
 */
export function hasTranslation(key: string, locale: AppLocale = DEFAULT_APP_LOCALE): boolean {
    const value = getNestedValue(translations[locale] as unknown as Record<string, unknown>, key);
    if (value) return true;

    if (locale !== 'en') {
        return !!getNestedValue(translations.en as unknown as Record<string, unknown>, key);
    }

    return false;
}

/**
 * Get list of missing translations for a locale
 */
export function getMissingTranslations(locale: AppLocale): string[] {
    if (locale === 'en') return [];

    const missing: string[] = [];
    const englishKeys = getAllKeys(translations.en);

    for (const key of englishKeys) {
        if (!getNestedValue(translations[locale] as unknown as Record<string, unknown>, key)) {
            missing.push(key);
        }
    }

    return missing;
}

/**
 * Get all keys from a nested object (dot notation)
 */
function getAllKeys(obj: Record<string, unknown>, prefix = ''): string[] {
    const keys: string[] = [];

    for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;

        if (value && typeof value === 'object' && !Array.isArray(value)) {
            keys.push(...getAllKeys(value as Record<string, unknown>, fullKey));
        } else if (typeof value === 'string') {
            keys.push(fullKey);
        }
    }

    return keys;
}

/**
 * Pluralization helper
 * Returns the appropriate translation based on count
 */
export function plural(
    key: { one: string; other: string },
    count: number,
    locale: AppLocale = DEFAULT_APP_LOCALE,
    values?: Record<string, string | number>
): string {
    const translation = count === 1 ? key.one : key.other;
    const finalTranslation = t(translation, locale, values);

    if (values) {
        return interpolate(finalTranslation, { ...values, count });
    }

    return interpolate(finalTranslation, { count: count.toString() });
}

const i18nExports = {
    t,
    getTranslations,
    hasTranslation,
    getMissingTranslations,
    plural,
    translations,
};

export default i18nExports;
