from rest_framework import serializers
from .models import User, Product, Listing, Order


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    name = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('name', 'email', 'password')

    def create(self, validated_data):
        name = validated_data.pop('name')
        first, *rest = name.split(' ', 1)
        user = User.objects.create_user(
            username=validated_data['email'],
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=first,
            last_name=rest[0] if rest else '',
        )
        return user


class UserSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'email', 'name', 'return_rate')

    def get_name(self, obj):
        return obj.get_full_name() or obj.email.split('@')[0]


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = '__all__'


class ListingSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    source_display = serializers.CharField(source='get_source_display', read_only=True)
    grade_display = serializers.CharField(source='get_grade_display', read_only=True)
    seller_name = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()

    class Meta:
        model = Listing
        fields = (
            'id', 'product', 'source', 'source_display',
            'grade', 'grade_display', 'condition_summary',
            'completeness', 'price', 'geohash5', 'status',
            'chosen_path', 'tier', 'ev_data',
            'seller_name', 'image', 'created_at',
        )

    def get_seller_name(self, obj):
        if obj.seller:
            return obj.seller.get_full_name() or obj.seller.email.split('@')[0]
        return None

    def get_image(self, obj):
        return obj.image_url or obj.product.reference_image_url


class CreateListingSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    category = serializers.CharField(max_length=100)
    description = serializers.CharField(required=False, allow_blank=True, default='')
    price = serializers.DecimalField(max_digits=10, decimal_places=2)
    mrp = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True, default=None)
    geohash5 = serializers.CharField(max_length=10, required=False, allow_blank=True, default='')
    condition_summary = serializers.CharField(required=False, allow_blank=True, default='')


class OrderSerializer(serializers.ModelSerializer):
    listing_id = serializers.SerializerMethodField()
    listing_title = serializers.SerializerMethodField()
    listing_price = serializers.SerializerMethodField()
    listing_image = serializers.SerializerMethodField()
    listing_grade = serializers.SerializerMethodField()
    listing_grade_display = serializers.SerializerMethodField()
    listing_source_display = serializers.SerializerMethodField()
    listing_category = serializers.SerializerMethodField()
    listing_mrp = serializers.SerializerMethodField()
    listing_chosen_path = serializers.SerializerMethodField()
    listing_tier = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = (
            'id', 'listing_id', 'listing_title', 'listing_price', 'listing_image',
            'listing_grade', 'listing_grade_display', 'listing_source_display',
            'listing_category', 'listing_mrp', 'listing_chosen_path', 'listing_tier',
            'status', 'is_p2p', 'escrow_released', 'return_window_closes', 'created_at',
        )

    def get_listing_title(self, obj):
        return obj.listing.product.title if obj.listing else 'Item no longer available'

    def get_listing_price(self, obj):
        return str(obj.listing.price) if obj.listing else None

    def get_listing_image(self, obj):
        if not obj.listing:
            return None
        return obj.listing.image_url or obj.listing.product.reference_image_url

    def get_listing_grade(self, obj):
        return obj.listing.grade if obj.listing else None

    def get_listing_id(self, obj):
        return obj.listing.pk if obj.listing else None

    def get_listing_grade_display(self, obj):
        return obj.listing.get_grade_display() if obj.listing else None

    def get_listing_source_display(self, obj):
        return obj.listing.get_source_display() if obj.listing else None

    def get_listing_category(self, obj):
        return obj.listing.product.category if obj.listing else None

    def get_listing_mrp(self, obj):
        return str(obj.listing.product.mrp) if obj.listing else None

    def get_listing_chosen_path(self, obj):
        return obj.listing.chosen_path if obj.listing else None

    def get_listing_tier(self, obj):
        return obj.listing.tier if obj.listing else None
