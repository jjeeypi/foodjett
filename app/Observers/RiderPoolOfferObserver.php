<?php

namespace App\Observers;

use App\Events\OrderStatusUpdated;
use App\Models\RiderPoolOffer;

class RiderPoolOfferObserver
{
    public function updated(RiderPoolOffer $offer): void
    {
        if (
            $offer->wasChanged('escalation_stage')
            && $offer->escalation_stage === 'customer_notified'
        ) {
            OrderStatusUpdated::dispatch($offer->order()->firstOrFail(), 'rider_search_delayed');
        }
    }
}
